from abc import ABC, abstractmethod
from sqlalchemy import func
from sqlalchemy.orm import Query
from decimal import Decimal

import config
from server import db
from server.exceptions import (
    NoTransferAllowedLimitError,
    MaximumPerTransferLimitError,
    TransferAmountLimitError,
    MinimumSentLimitError,
    TransferBalanceFractionLimitError,
    TransferCountLimitError
)
from server.models.credit_transfer import CreditTransfer
from server.sempo_types import TransferAmount
from server.utils.transfer_limits.filters import (
    combine_filter_lists,
    matching_sender_user_filter,
    not_rejected_filter,
    after_time_period_filter,
    matching_transfer_type_filter,
    regular_payment_filter
)
from server.utils.transfer_limits.types import (
    NumericAvailability,
    AppliedToTypes,
    ApplicationFilter,
    QueryConstructorFunc,
    AggregationFilter
)


class BaseTransferLimit(ABC):
    """
    Base Limit Class. All limits use `applies_to_transfer` to determine if they are applied.
    Specific Limit rules vary hugely, so this class is pretty sparse,
    however, the usage of all limits follows the same overall process:

    1. Check if the limit applies to the transfer
       This is done using `applies_to_transfer`, and is  based off:
        a) Type/Subtype
        b) Query Filters

    2. Calculate how much of the limit is available, without considering this transfer
       This is done using `available`. This number may be fixed, though it often varies due to a base amount that is
       deducted from by aggregating across previous transfers and subtracting.
       See the AggregateLimit abstract class for an example of this.

    3. Calculate how much the current transfer cases uses
       This is done using `case_will_use`

    4. Check if the current case uses more than what's available
       This is done using `validate_transfer`. If there's insufficient availability, throw an exception
       that is appropriately subclassed from TransferLimitError


    While the above steps represent a typical "workflow", all the functions defined in this Abstract Class can and
    are called upon in other contexts outside of pure validation, for example to tell a user how much of a limit
    is remaining for them.
    These methods can be overridden as required. See NoTransferAllowedLimit for an example of this.

    All methods require a CreditTransfer object, as this contains the full context of amount, senders, recipients
    and so forth to fully determine how to apply the limit
    """

    @abstractmethod
    def available(self, transfer: CreditTransfer) -> NumericAvailability:
        """
        How much of the limit is still available. Uses a CreditTransfer object for context.
        Is generally an amount, but can also be something like a number of transfers.
        :param transfer: the transfer in question
        :return: Count or Amount
        """
        pass

    @abstractmethod
    def case_will_use(self, transfer: CreditTransfer) -> NumericAvailability:
        """
        How much of the limit will be used in this particular transfer case.
        Is generally an amount, but can also be something like a number of transfers.
        :param transfer: the transfer in question
        :return: count or TransferAmount
        """

    @abstractmethod
    def throw_validation_error(self, transfer: CreditTransfer, available: NumericAvailability):
        """
        Throws some sort of TransferLimitError
        """
        pass

    def validate_transfer(self, transfer: CreditTransfer):
        """
        Will raise an exception if the provided transfer doesn't pass this limit
        :param transfer: the transfer you wish to validate
        :return: Nothing, just throws the appropriate error if the transfer doesn't pass
        """

        available = self.available(transfer)
        if available < self.case_will_use(transfer):
            self.throw_validation_error(transfer, available)

    def applies_to_transfer(self, transfer: CreditTransfer) -> bool:
        """
        Determines if the limit applies to the given transfer. Uses a two step process:

        - Include transfer only if it matches either a Type or a (Type,Subtype) tuple from applied_to_transfer_types
        - Include transfer only if calling `application_filter` on the transfer returns true

        :param transfer: the credit transfer in question
        :return: boolean of whether the limit is applied or not
        """
        return (
                       transfer.transfer_type in self.applied_to_transfer_types
                       or (transfer.transfer_type, transfer.transfer_subtype) in self.applied_to_transfer_types
               ) and self.application_filter(transfer)

    def __repr__(self):
        return f"<{self.__class__.__name__}: {self.name}>"