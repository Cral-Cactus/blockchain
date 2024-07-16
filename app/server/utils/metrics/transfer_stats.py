from sqlalchemy.sql import func

from server.models.credit_transfer import CreditTransfer
from server.utils.metrics import filters, metrics_cache, metric, metric_group, group
from server.utils.metrics.metrics_const import *

from server import db

class TransferStats(metric_group.MetricGroup):
    def __init__(self, group_strategy, timeseries_unit = 'day', token=None, date_filter_attributes=None):
        self.filterable_attributes = [DATE, CUSTOM_ATTRIBUTE, TRANSFER_ACCOUNT, CREDIT_TRANSFER, USER]
        self.timeseries_unit = timeseries_unit
        self.date_filter_attributes = date_filter_attributes
        self.metrics = []

        total_amount_query = db.session.query(func.sum(CreditTransfer.transfer_amount).label('total'))
        self.metrics.append(metric.Metric(
            metric_name='total_distributed',
            query=total_amount_query,
            object_model=CreditTransfer,
            stock_filters=[filters.disbursement_filters],
            query_caching_combinatory_strategy=metrics_cache.SUM,
            filterable_by=self.filterable_attributes,
            bypass_user_filters=True,
        ))

        self.metrics.append(metric.Metric(
            metric_name='total_reclaimed',
            query=total_amount_query,
            object_model=CreditTransfer,
            stock_filters=[filters.reclamation_filters],
            query_caching_combinatory_strategy=metrics_cache.SUM,
            filterable_by=self.filterable_attributes,
            bypass_user_filters=True,
        ))

        self.metrics.append(metric.Metric(
            metric_name='total_withdrawn',
            query=total_amount_query,
            object_model=CreditTransfer,
            stock_filters=[filters.withdrawal_filters],
            query_caching_combinatory_strategy=metrics_cache.SUM,
            filterable_by=self.filterable_attributes,
            bypass_user_filters=True,
        ))