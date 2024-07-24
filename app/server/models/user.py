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

referrals = Table(
    'referrals', ModelBase.metadata,
    db.Column('referred_user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('referrer_user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True)
)


    _last_seen = db.Column(db.DateTime)

    email = db.Column(db.String())
    _phone = db.Column(db.String(), unique=True, index=True)
    _public_serial_number = db.Column(db.String())
    uuid = db.Column(db.String(), index=True)

    nfc_serial_number = db.Column(db.String())

    password_hash = db.Column(db.String(200))
    one_time_code = db.Column(db.String)
    secret = db.Column(db.String())
    _TFA_secret = db.Column(db.String(128))
    TFA_enabled = db.Column(db.Boolean, default=False)
    pin_hash = db.Column(db.String())
    seen_latest_terms = db.Column(db.Boolean, default=False)

    failed_pin_attempts = db.Column(db.Integer, default=0)

    default_currency = db.Column(db.String())

    _location = db.Column(db.String(), index=True)
    lat = db.Column(db.Float(), index=True)
    lng = db.Column(db.Float(), index=True)

    _held_roles = db.Column(JSONB)

    is_activated = db.Column(db.Boolean, default=False)
    is_disabled = db.Column(db.Boolean, default=False)
    is_phone_verified = db.Column(db.Boolean, default=False)
    is_self_sign_up = db.Column(db.Boolean, default=True)
    is_market_enabled = db.Column(db.Boolean, default=False)

    password_reset_tokens = db.Column(JSONB, default=[])
    pin_reset_tokens = db.Column(JSONB, default=[])

    terms_accepted = db.Column(db.Boolean, default=True)

    matched_profile_pictures = db.Column(JSON)

    business_usage_id = db.Column(db.Integer, db.ForeignKey(TransferUsage.id))

    transfer_accounts = db.relationship(
        "TransferAccount",
        secondary=user_transfer_account_association_table,
        back_populates="users")

    default_transfer_account_id = db.Column(db.Integer, db.ForeignKey('transfer_account.id'), index=True)

    default_transfer_account = db.relationship('TransferAccount',
                                           primaryjoin='TransferAccount.id == User.default_transfer_account_id',
                                           lazy=True,
                                           uselist=False)

    default_organisation_id = db.Column( db.Integer, db.ForeignKey('organisation.id'), index=True)

    default_organisation = db.relationship('Organisation',
                                           primaryjoin=Organisation.id == default_organisation_id,
                                           lazy=True,
                                           uselist=False)

    ussd_sessions = db.relationship('UssdSession', backref='user', lazy=True, foreign_keys='UssdSession.user_id')

    uploaded_images = db.relationship('UploadedResource', backref='user', lazy=True,
                                      foreign_keys='UploadedResource.user_id')

    kyc_applications = db.relationship('KycApplication', backref='user', lazy=True,
                                       foreign_keys='KycApplication.user_id')

    devices = db.relationship('DeviceInfo', backref='user', lazy=True)

    referrals = db.relationship('User',
                                secondary=referrals,
                                primaryjoin="User.id == referrals.c.referred_user_id",
                                secondaryjoin="User.id == referrals.c.referrer_user_id",
                                backref='referred_by')

    transfer_card = db.relationship(
        'TransferCard', backref='user', lazy=True, uselist=False)

    credit_sends = db.relationship('CreditTransfer', backref='sender_user',
                                   lazy='dynamic', foreign_keys='CreditTransfer.sender_user_id')

    credit_receives = db.relationship('CreditTransfer', backref='recipient_user',
                                      lazy='dynamic', foreign_keys='CreditTransfer.recipient_user_id')

    ip_addresses = db.relationship('IpAddress', backref='user', lazy=True)

    feedback = db.relationship('Feedback', backref='user',
                               lazy='dynamic', foreign_keys='Feedback.user_id')

    custom_attributes = db.relationship("CustomAttributeUserStorage", backref='user',
                                        lazy=True, foreign_keys='CustomAttributeUserStorage.user_id')

    exchanges = db.relationship("Exchange", backref="user")

    @hybrid_property
    def coordinates(self):
        return str(self.lat) + ', ' + str(self.lng)

    @coordinates.expression
    def coordinates(cls):
        return cast(cls.lat, String) + ', ' + cast(cls.lng, String)

    def delete_user_and_transfer_account(self):
        try:
            ta = self.default_transfer_account
            ta.delete_transfer_account_from_user(user=self)

            timenow = datetime.datetime.utcnow()
            self.deleted = timenow

            self.first_name = None
            self.last_name = None
            self.phone = None

            transfer_card = None

            try:
                transfer_card = TransferCard.get_transfer_card(self.public_serial_number)
            except NoTransferCardError as e:
                pass

            if transfer_card and not transfer_card.is_disabled:
                transfer_card.disable()

        except (ResourceAlreadyDeletedError, TransferAccountDeletionError) as e:
            raise e

    @hybrid_property
    def cashout_authorised(self):
        # loop over all
        any_valid_token = [t.token for t in self.transfer_accounts]
        for token in any_valid_token:
            ct = server.models.credit_transfer
            example_transfer = ct.CreditTransfer(
                transfer_type=ct.TransferTypeEnum.PAYMENT,
                transfer_subtype=ct.TransferSubTypeEnum.AGENT_OUT,
                sender_user=self,
                recipient_user=self,
                token=token,
                amount=0)

            limits = example_transfer.get_transfer_limits()
            limit = limits[0]
            return limit.period_amount > 0
        else:
            # default to false
            return False

    @hybrid_property
    def phone(self):
        return self._phone

    @phone.setter
    def phone(self, phone):
        self._phone = proccess_phone_number(phone)

    @hybrid_property
    def public_serial_number(self):
        return self._public_serial_number

    @public_serial_number.setter
    def public_serial_number(self, public_serial_number):
        self._public_serial_number = public_serial_number

        try:
            transfer_card = TransferCard.get_transfer_card(
                public_serial_number)

            if transfer_card.user_id is None and transfer_card.nfc_serial_number is not None:
                self.nfc_serial_number = transfer_card.nfc_serial_number
                self.transfer_card = transfer_card

        except NoTransferCardError:
            pass

    @hybrid_property
    def tfa_url(self):

        if not self._TFA_secret:
            self.set_TFA_secret()
            db.session.flush()

        secret_key = self.get_TFA_secret()
        return pyotp.totp.TOTP(secret_key).provisioning_uri(
            self.email,
            issuer_name='stengo: {}'.format(
                current_app.config.get('DEPLOYMENT_NAME'))
        )

    @hybrid_property
    def location(self):
        return self._location

    @location.setter
    def location(self, location):

        self._location = location

    def attempt_update_gps_location(self):
        from server.utils.location import async_set_user_gps_from_location
        if self._location is not None and self._location is not '':
            db.session.flush()
            add_after_request_executor_job(
                async_set_user_gps_from_location,
                kwargs={'user_id': self.id, 'location': self._location}
            )
        add_after_request_executor_job(
            async_set_user_gps_from_location,
            kwargs={'user_id': self.id, 'location': self._location}
        )
    @hybrid_property
    def roles(self):
        if self._held_roles is None:
            return {}
        return self._held_roles

    def remove_all_held_roles(self):
        self._held_roles = {}

    def set_held_role(self, role: str, tier: Union[str, None]):
        if role not in ACCESS_ROLES:
            raise RoleNotFoundException("Role '{}' not valid".format(role))
        allowed_tiers = ACCESS_ROLES[role]
        if tier is not None and tier not in allowed_tiers:
            raise TierNotFoundException(
                "Tier {} not recognised for role {}".format(tier, role))

        if self._held_roles is None:
            self._held_roles = {}
        if tier is None:
            self._held_roles.pop(role, None)
        else:
            self._held_roles[role] = tier

    @hybrid_property
    def has_admin_role(self):
        return AccessControl.has_any_tier(self.roles, 'ADMIN')

    @has_admin_role.expression
    def has_admin_role(cls):
        return cls._held_roles.has_key('ADMIN')

    @hybrid_property
    def has_vendor_role(self):
        return AccessControl.has_any_tier(self.roles, 'VENDOR')

    @has_vendor_role.expression
    def has_vendor_role(cls):
        return cls._held_roles.has_key('VENDOR')

    @hybrid_property
    def has_beneficiary_role(self):
        return AccessControl.has_any_tier(self.roles, 'BENEFICIARY')

    @has_beneficiary_role.expression
    def has_beneficiary_role(cls):
        return cls._held_roles.has_key('BENEFICIARY')

    @hybrid_property
    def has_token_agent_role(self):
        return AccessControl.has_any_tier(self.roles, 'TOKEN_AGENT')

    @has_token_agent_role.expression
    def has_token_agent_role(cls):
        return cls._held_roles.has_key('TOKEN_AGENT')

    @hybrid_property
    def has_group_account_role(self):
        return AccessControl.has_any_tier(self.roles, 'GROUP_ACCOUNT')

    @has_group_account_role.expression
    def has_group_account_role(cls):
        return cls._held_roles.has_key('GROUP_ACCOUNT')

    @hybrid_property
    def admin_tier(self):
        return self._held_roles.get('ADMIN', None)

    @hybrid_property
    def vendor_tier(self):
        return self._held_roles.get('VENDOR', None)

    @hybrid_property
    def is_vendor(self):
        return AccessControl.has_sufficient_tier(self.roles, 'VENDOR', 'vendor')

    @hybrid_property
    def is_supervendor(self):
        return AccessControl.has_sufficient_tier(self.roles, 'VENDOR', 'supervendor')

    @hybrid_property
    def organisation_ids(self):
        return [organisation.id for organisation in self.organisations]

    @property
    def transfer_account(self):
        active_organisation = getattr(g, "active_organisation", None) or self.fallback_active_organisation()

        return self.get_transfer_account_for_organisation(active_organisation)

    @hybrid_method
    def great_circle_distance(self, lat, lng):
        """
        Tries to calculate the great circle distance between
        the two locations in km by using the Haversine formula.
        """
        return self._haversine(math, self, lat, lng)
