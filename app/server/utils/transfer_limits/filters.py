import datetime
from functools import reduce
from typing import List

from sqlalchemy import or_

from server.models.credit_transfer import CreditTransfer
from server.utils.transfer_enums import TransferSubTypeEnum, TransferTypeEnum, TransferStatusEnum


def combine_filter_lists(filter_lists: List[List]) -> List:
    return reduce(lambda f, i: f + i, filter_lists, [])


def after_time_period_filter(days: int):
    epoch = datetime.datetime.today() - datetime.timedelta(days=days)
    return [CreditTransfer.created >= epoch]


def matching_sender_user_filter(transfer: CreditTransfer):
    return [CreditTransfer.sender_user == transfer.sender_user]


def regular_payment_filter(transfer: CreditTransfer):
    return [CreditTransfer.transfer_subtype == TransferSubTypeEnum.STANDARD]