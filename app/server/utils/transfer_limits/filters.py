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