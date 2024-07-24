import json
from typing import Union
from sqlalchemy.ext.hybrid import hybrid_property, hybrid_method
from sqlalchemy.dialects.postgresql import JSON, JSONB
from sqlalchemy import text, Table, cast, String
from sqlalchemy.sql.functions import func
from itsdangerous import TimedJSONWebSignatureSerializer, BadSignature, SignatureExpired
from cryptography.fernet import Fernet
import pyotp
import config
from flask import current_app, g
import datetime
import bcrypt
import math
import jwt
import random
import string
import sentry_sdk
from sqlalchemy import or_, and_

from server import db, celery_app, bt
from server.utils.misc import encrypt_string, decrypt_string
from server.utils.access_control import AccessControl
from server.utils.phone import proccess_phone_number
from server.utils.executor import add_after_request_executor_job
from server.utils.audit_history import track_updates
from server.utils.amazon_ses import send_reset_email

from server.utils.transfer_account import (
    find_transfer_accounts_with_matching_token
)

# circular imports
import server.models.transfer_account
import server.models.credit_transfer
import server.utils.transfer_enums

from server.models.utils import ModelBase, ManyOrgBase, user_transfer_account_association_table, SoftDelete
from server.models.organisation import Organisation
from server.models.blacklist_token import BlacklistToken
from server.models.transfer_card import TransferCard
from server.models.transfer_usage import TransferUsage
from server.exceptions import (
    RoleNotFoundException,
    TierNotFoundException,
    NoTransferCardError,
    ResourceAlreadyDeletedError,
    TransferAccountDeletionError
)
from server.constants import (
    ACCESS_ROLES
)

# self-referencing-m2m-relationship
referrals = Table(
    'referrals', ModelBase.metadata,
    db.Column('referred_user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('referrer_user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True)
)


class User(ManyOrgBase, ModelBase, SoftDelete):
    """Establishes the identity of a user for both making transactions and more general interactions.

        Admin users are created through the auth api by registering
        an account with an email that has been pre-approved on the whitelist.
        By default, admin users only have minimal access levels (view).
        Permissions must be elevated manually in the database.

        Transaction-capable users (vendors and beneficiaries) are
        created using the POST user API or the bulk upload function
    """
    __tablename__ = 'user'
    audit_history_columns = ['first_name',
        'last_name',
        'preferred_language',
        'primary_blockchain_address',
        'email',
        '_phone',
        '_public_serial_number',
        'uuid',
        'nfc_serial_number',
        'default_currency',
        '_location',
        'is_activated',
        'is_disabled',
        'terms_accepted',
        '_held_roles',
        '_deleted'
    ]

    # override ModelBase deleted to add an index
    created = db.Column(db.DateTime, default=datetime.datetime.utcnow, index=True)

    first_name = db.Column(db.String())
    last_name = db.Column(db.String())
    preferred_language = db.Column(db.String())

    primary_blockchain_address = db.Column(db.String())