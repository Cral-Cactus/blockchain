from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy import func
from server.exceptions import (
    IconNotSupportedException,
    TransferUsageNameDuplicateException
)
from server.constants import (
    MATERIAL_COMMUNITY_ICONS
)

from server import db
from server.models.utils import ModelBase, credit_transfer_transfer_usage_association_table

class TransferUsage(ModelBase):
    __tablename__ = 'transfer_usage'

    _name = db.Column(db.String, unique=True, index=True)
    is_cashout = db.Column(db.Boolean)
    _icon = db.Column(db.String)
    priority = db.Column(db.Integer)
    translations = db.Column(JSON)
    default = db.Column(db.Boolean)

    users = db.relationship('User', backref='business_usage', lazy=True)

    credit_transfers = db.relationship(
        "CreditTransfer",
        secondary=credit_transfer_transfer_usage_association_table,
        back_populates="transfer_usages",
    )

    @hybrid_property
    def icon(self):
        return self._icon

    @icon.setter
    def icon(self, icon):
        if icon not in MATERIAL_COMMUNITY_ICONS:
            raise IconNotSupportedException(f'Icon {icon} not supported or found')
        self._icon = icon

    def __repr__(self):
        return f'<Transfer Usage {self.id}: {self.name}>'