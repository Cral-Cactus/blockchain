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

        # Timeseries Metrics
        if group_strategy:
            transaction_volume_timeseries_query = group_strategy.build_query_group_by_with_join(db.session.query(func.sum(CreditTransfer.transfer_amount).label('volume'),
                    func.date_trunc(self.timeseries_unit, self.date_filter_attributes[CreditTransfer]).label('date'), group_strategy.group_by_column).group_by(func.date_trunc(self.timeseries_unit, self.date_filter_attributes[CreditTransfer])), CreditTransfer)
            aggregated_transaction_volume_query = group_strategy.build_query_group_by_with_join(db.session.query(func.sum(CreditTransfer.transfer_amount).label('volume'), group_strategy.group_by_column), CreditTransfer)
        else:
            transaction_volume_timeseries_query = db.session.query(func.sum(CreditTransfer.transfer_amount).label('volume'),
                    func.date_trunc(self.timeseries_unit, self.date_filter_attributes[CreditTransfer]).label('date')).group_by(func.date_trunc(self.timeseries_unit, self.date_filter_attributes[CreditTransfer]))
            aggregated_transaction_volume_query = None
        total_transaction_volume_query = db.session.query(func.sum(CreditTransfer.transfer_amount).label('volume'))

        self.metrics.append(metric.Metric(
            metric_name='all_payments_volume',
            is_timeseries=True,
            query=transaction_volume_timeseries_query,
            aggregated_query=aggregated_transaction_volume_query,
            total_query=total_transaction_volume_query,
            object_model=CreditTransfer,
            query_caching_combinatory_strategy=metrics_cache.SUM_OBJECTS,
            aggregated_query_caching_combinatory_strategy=metrics_cache.SUM_OBJECTS,
            total_query_caching_combinatory_strategy=metrics_cache.TALLY,
            stock_filters=[filters.complete_transfer_filter],
            filterable_by=self.filterable_attributes,
            query_actions=[FORMAT_TIMESERIES],
            aggregated_query_actions=[FORMAT_AGGREGATE_METRICS],
            total_query_actions=[GET_FIRST],
            value_type=CURRENCY,
            token=token
        ))