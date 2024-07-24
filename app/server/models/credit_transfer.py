import datetime
from typing import List
from decimal import Decimal

from sqlalchemy.dialects.postgresql import JSON, JSONB
from flask import current_app, g
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy import Index
from sqlalchemy.sql import func
from sqlalchemy import or_
from uuid import uuid4

from server import db, bt
from server.models.utils import BlockchainTaskableBase, ManyOrgBase, credit_transfer_transfer_usage_association_table,\
    disbursement_credit_transfer_association_table, credit_transfer_approver_user_association_table
from server.models.token import Token
from server.models.user import User
from server.models.transfer_account import TransferAccount
from server.utils.access_control import AccessControl
from server.utils.metrics.metrics_cache import clear_metrics_cache, rebuild_metrics_cache

from server.exceptions import (
    TransferLimitError,
    InsufficientBalanceError,
    NoTransferAccountError,
    MinimumSentLimitError,
    NoTransferAllowedLimitError,
    MaximumPerTransferLimitError,
    TransferAmountLimitError,
    TransferCountLimitError,
    TransferBalanceFractionLimitError)

from server.utils.transfer_account import find_transfer_accounts_with_matching_token

from server.utils.transfer_enums import (
    TransferTypeEnum,
    TransferSubTypeEnum,
    TransferStatusEnum,
    TransferModeEnum,
    BlockchainStatus
)


class CreditTransfer(ManyOrgBase, BlockchainTaskableBase):
    __tablename__ = 'credit_transfer'

    uuid            = db.Column(db.String, unique=True)
    batch_uuid      = db.Column(db.String)

    # override ModelBase deleted to add an index
    created = db.Column(db.DateTime, default=datetime.datetime.utcnow, index=True)

    resolved_date   = db.Column(db.DateTime)
    _transfer_amount_wei = db.Column(db.Numeric(27), default=0)

    transfer_type       = db.Column(db.Enum(TransferTypeEnum), index=True)
    transfer_subtype    = db.Column(db.Enum(TransferSubTypeEnum), index=True)
    transfer_status     = db.Column(db.Enum(TransferStatusEnum), default=TransferStatusEnum.PENDING)
    transfer_mode       = db.Column(db.Enum(TransferModeEnum), index=True)
    transfer_use        = db.Column(JSON) # Deprecated
    transfer_usages = db.relationship(
        "TransferUsage",
        secondary=credit_transfer_transfer_usage_association_table,
        back_populates="credit_transfers",
        lazy='joined'
    )
    transfer_metadata = db.Column(JSONB)

    exclude_from_limit_calcs = db.Column(db.Boolean, default=False)

    resolution_message = db.Column(db.String())

    token_id        = db.Column(db.Integer, db.ForeignKey(Token.id))

    sender_transfer_account_id       = db.Column(db.Integer, db.ForeignKey("transfer_account.id"), index=True)
    sender_transfer_account          = db.relationship('TransferAccount', foreign_keys=[sender_transfer_account_id], back_populates='credit_sends', lazy='joined')

    recipient_transfer_account_id    = db.Column(db.Integer, db.ForeignKey("transfer_account.id"), index=True)
    recipient_transfer_account          = db.relationship('TransferAccount', foreign_keys=[recipient_transfer_account_id], back_populates='credit_receives', lazy='joined')

    received_third_party_sync = db.Column(db.Boolean, default=False)
    
    sender_blockchain_address_id    = db.Column(db.Integer, db.ForeignKey("blockchain_address.id"), index=True)
    recipient_blockchain_address_id = db.Column(db.Integer, db.ForeignKey("blockchain_address.id"), index=True)

    sender_transfer_card_id = db.Column(db.Integer, db.ForeignKey("transfer_card.id"), index=True)

    sender_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), index=True)
    recipient_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), index=True)

    is_initial_disbursement = db.Column(db.Boolean, default=False)

    attached_images = db.relationship('UploadedResource', backref='credit_transfer', lazy='joined')

    fiat_ramp = db.relationship('FiatRamp', backref='credit_transfer', lazy=True, uselist=False)

    __table_args__ = (Index('updated_index', "updated"), )

    from_exchange = db.relationship('Exchange', backref='from_transfer', lazy='joined', uselist=False,
                                     foreign_keys='Exchange.from_transfer_id')

    to_exchange = db.relationship('Exchange', backref='to_transfer', lazy=True, uselist=False,
                                  foreign_keys='Exchange.to_transfer_id')

    disbursement = db.relationship(
        "Disbursement",
        secondary=disbursement_credit_transfer_association_table,
        back_populates="credit_transfers",
        uselist=False,
        lazy=True
    )

    approvers = db.relationship(
        "User",
        secondary=credit_transfer_approver_user_association_table,
        lazy=True
    )

    def add_message(self, message):
        self.resolution_message = message

    @hybrid_property
    def transfer_amount(self):
        return (self._transfer_amount_wei or 0) / int(1e16)

    @transfer_amount.setter
    def transfer_amount(self, val):
        self._transfer_amount_wei = val * int(1e16)

    @hybrid_property
    def rounded_transfer_amount(self):
        return (self._transfer_amount_wei or 0) / int(1e18)

    @hybrid_property
    def public_transfer_type(self):
        if self.transfer_type == TransferTypeEnum.PAYMENT:
            if self.transfer_subtype == TransferSubTypeEnum.STANDARD or None:
                return TransferTypeEnum.PAYMENT
            else:
                return self.transfer_subtype
        else:
            return self.transfer_type

    @public_transfer_type.expression
    def public_transfer_type(cls):
        from sqlalchemy import case, cast, String
        return case([
                (cls.transfer_subtype == TransferSubTypeEnum.STANDARD, cast(cls.transfer_type, String)),
                (cls.transfer_type == TransferTypeEnum.PAYMENT, cast(cls.transfer_subtype, String)),
            ],
            else_ = cast(cls.transfer_type, String)
        )

    def send_blockchain_payload_to_worker(self, is_retry=False, queue='high-priority'):
        sender_approval = self.sender_transfer_account.get_or_create_system_transfer_approval()
        recipient_approval = self.recipient_transfer_account.get_or_create_system_transfer_approval()

        approval_priors = list(
            filter(lambda x: x is not None,
                   [
                       sender_approval.eth_send_task_uuid, sender_approval.approval_task_uuid,
                       recipient_approval.eth_send_task_uuid, recipient_approval.approval_task_uuid
                   ]))

        other_priors = [t.blockchain_task_uuid for t in self._get_required_prior_tasks()]

        all_priors = approval_priors + other_priors

        return bt.make_token_transfer(
            signing_address=self.sender_transfer_account.organisation.system_blockchain_address,
            token=self.token,
            from_address=self.sender_transfer_account.blockchain_address,
            to_address=self.recipient_transfer_account.blockchain_address,
            amount=self.transfer_amount,
            prior_tasks=all_priors,
            queue=queue,
            task_uuid=self.blockchain_task_uuid
        )

    def _get_required_prior_tasks(self):
        complete_transfer_base_query = (
            CreditTransfer.query.filter(CreditTransfer.transfer_status == TransferStatusEnum.COMPLETE)
        ).execution_options(show_all=True)

        most_recent_out_of_batch_send = (
            complete_transfer_base_query
                .order_by(CreditTransfer.id.desc())
                .filter(CreditTransfer.sender_transfer_account == self.sender_transfer_account)
                .filter(CreditTransfer.id != self.id)
                .filter(or_(CreditTransfer.batch_uuid != self.batch_uuid,
                            CreditTransfer.batch_uuid == None  # Only exclude matching batch_uuids if they're not null
                            )
                ).execution_options(show_all=True).first()
        )

        base_receives_query = (
            complete_transfer_base_query
                .filter(CreditTransfer.recipient_transfer_account == self.sender_transfer_account)
        ).execution_options(show_all=True)

        if most_recent_out_of_batch_send:
            more_recent_receives = base_receives_query.filter(CreditTransfer.id > most_recent_out_of_batch_send.id).all()

            required_priors = more_recent_receives + [most_recent_out_of_batch_send]

            if most_recent_out_of_batch_send.batch_uuid is not None:
                same_batch_priors = complete_transfer_base_query.filter(
                    CreditTransfer.batch_uuid == most_recent_out_of_batch_send.batch_uuid
                ).execution_options(show_all=True).all()

                required_priors = required_priors + same_batch_priors

        else:
            required_priors = base_receives_query.all()

        required_priors = [prior for prior in required_priors if prior.blockchain_status != BlockchainStatus.SUCCESS]

        return set(required_priors)

        
    def add_approver_and_resolve_as_completed(self, user=None):
        if not user:
            user = db.session.query(User).filter(User.id == g.user.id).first()
        if user not in self.approvers:
            self.approvers.append(user)
        if len(self.approvers) == 1:
            if current_app.config['REQUIRE_MULTIPLE_APPROVALS']:
                self.transfer_status = TransferStatusEnum.PARTIAL
        if self.check_if_fully_approved():
            self.resolve_as_complete_and_trigger_blockchain()

    def check_if_fully_approved(self):
        if current_app.config['REQUIRE_MULTIPLE_APPROVALS'] and not AccessControl.has_sufficient_tier(g.user.roles, 'ADMIN', 'stengoadmin'):
            if len(self.approvers) <=1:
                return False
            else:
                if current_app.config['ALLOWED_APPROVERS']:
                    for user in self.approvers:
                        if user.email in current_app.config['ALLOWED_APPROVERS']:
                            return True
                else:
                    return True
        else:
            return True

    def resolve_as_complete_with_existing_blockchain_transaction(self, transaction_hash):

        self.resolve_as_complete()

        self.blockchain_status = BlockchainStatus.SUCCESS
        self.blockchain_hash = transaction_hash

    def resolve_as_complete_and_trigger_blockchain(
            self,
            existing_blockchain_txn=None,
            queue='high-priority',
            batch_uuid: str=None
    ):

        self.resolve_as_complete(batch_uuid)

        if not existing_blockchain_txn:
            self.blockchain_task_uuid = str(uuid4())
            g.pending_transactions.append((self, queue))

    def resolve_as_complete(self, batch_uuid=None):
        if self.transfer_status not in [None, TransferStatusEnum.PENDING, TransferStatusEnum.PARTIAL]:
            raise Exception(f'Resolve called multiple times for transfer {self.id}')
        try:
            self.check_sender_transfer_limits()
        except TransferLimitError as e:
            if hasattr(g, 'user') and AccessControl.has_suffient_role(g.user.roles, {'ADMIN': 'stengoadmin'}):
                self.add_message(f'Warning: {e}')
            else:
                raise e

        self.resolved_date = datetime.datetime.utcnow()
        self.transfer_status = TransferStatusEnum.COMPLETE
        self.blockchain_status = BlockchainStatus.PENDING
        self.update_balances()

        if (datetime.datetime.utcnow() - self.created).seconds > 5:
            clear_metrics_cache()
            rebuild_metrics_cache()
        if self.recipient_user and self.recipient_user.transfer_card:
            self.recipient_user.transfer_card.update_transfer_card()

        if batch_uuid:
            self.batch_uuid = batch_uuid

        if self.fiat_ramp and self.transfer_type in [TransferTypeEnum.DEPOSIT, TransferTypeEnum.WITHDRAWAL]:
            self.fiat_ramp.resolve_as_complete()