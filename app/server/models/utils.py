from contextlib import contextmanager
from flask import g, request
import datetime
from dateutil import parser

from sqlalchemy import event, inspect
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Query
from sqlalchemy import or_

import server
from server import db, bt, AppQuery
from server.exceptions import OrganisationNotProvidedException, ResourceAlreadyDeletedError
from server.utils.transfer_enums import BlockchainStatus


@contextmanager
def ephemeral_alchemy_object(mod: db.Model, *args, **kwargs):
    # weird SQLAlchemy behaviour cause object  to be persisted under some circumstances, even if they're not committed
    # See: https://hades.github.io/2013/06/sqlalchemy-adds-objects-collections-automatically/
    # Use this to make sure an object definitely doesn't hang round

    instance = mod(*args, **kwargs)
    yield instance

    for f in [db.session.expunge, db.session.delete]:
        # Can't delete transient objects, so we expunge them first instead
        try:
            f(instance)
        except:
            # We don't care about no exceptions, we just want the object GONE!!!
            pass


def get_authorising_user_id():
    if hasattr(g, 'user'):
        return g.user.id
    elif hasattr(g, 'authorising_user_id'):
        return g.authorising_user_id
    else:
        return None

@contextmanager
def no_expire():
    s = db.session()
    s.expire_on_commit = False
    yield
    s.expire_on_commit = True

@event.listens_for(AppQuery, "before_compile", retval=True)
def filter_by_org(query):
    """A query compilation rule that will add limiting criteria for every
    subclass of OrgBase"""
    org_check = query._execution_options.get("org_check", False)
    show_deleted = getattr(g, "show_deleted", False) or query._execution_options.get("show_deleted", False)
    show_all = getattr(g, "show_all", False) or query._execution_options.get("show_all", False)
    # We want to support multiple active organizations, but only for select GET requets.
    # This is done through a multi_org flag, very similar to the show_all flag
    multi_org = getattr(g, "multi_org", False) or query._execution_options.get("multi_org", False)
    if show_all and show_deleted:
        return query
    if org_check:
        return query
    has_many_orgs = db.session.query(server.models.organisation.Organisation.id).execution_options(org_check=True).count() > 1
    
    for ent in query.column_descriptions:
        entity = ent['entity']
        if entity is None:
            continue
        insp = inspect(ent['entity'])
        mapper = getattr(insp, 'mapper', None)

        if mapper:
            # if subclass SoftDelete exists and not show_deleted, return non-deleted items, else show deleted
            if issubclass(mapper.class_, SoftDelete) and not show_deleted:
                query = query.enable_assertions(False).filter(ent['entity'].deleted == None)

            if show_all and not show_deleted:
                return query

            # if the subclass OrgBase exists, then filter by organisations - else, return default query
            if issubclass(mapper.class_, ManyOrgBase) or issubclass(mapper.class_, OneOrgBase):
                try:
                    # member_organisations = getattr(g, "member_organisations", [])
                    active_organisation = getattr(g, "active_organisation", None)
                    active_organisation_id = getattr(active_organisation, "id", None)
                    # If we're operating on a query supporting multi_org, AND the application
                    # context has query_organisations set from the HTTP request, use those  
                    # organizations. Otherwise, use a singleton of the current active org 
                    query_organisations = [active_organisation_id] if active_organisation_id else []
                    if getattr(g, 'query_organisations', None):
                        if not multi_org:
                            raise Exception('Multiple organizations not supported for this operation')
                        query_organisations = g.query_organisations
                    if has_many_orgs:
                        if issubclass(mapper.class_, ManyOrgBase):
                            # filters many-to-many
                            query = query.enable_assertions(False).filter(or_(
                                ent['entity'].is_public == True,
                                ent['entity'].organisations.any(
                                    server.models.organisation.Organisation.id.in_(query_organisations)),
                            ))
                        else:
                            query = query.enable_assertions(False).filter(or_(
                                ent['entity'].is_public == True,
                                ent['entity'].organisation_id == active_organisation_id,
                                ent['entity'].organisation_id.in_(query_organisations),
                            ))

                except AttributeError:
                    raise

                except TypeError:
                    raise OrganisationNotProvidedException('Must provide organisation ID or specify SHOW_ALL flag')

            elif issubclass(mapper.class_, OneOrgBase):
                # must filter directly on query
                raise OrganisationNotProvidedException('{} has a custom org base. Must filter directly on query'.format(ent['entity']))

    return query

    disbursement_transfer_account_association_table = db.Table(
    'disbursement_transfer_account_association_table',
    db.Model.metadata,
    db.Column('disbursement_id', db.Integer, db.ForeignKey('disbursement.id'), index=True),
    db.Column('transfer_account_id', db.Integer, db.ForeignKey('transfer_account.id'), index=True)
)

disbursement_credit_transfer_association_table = db.Table(
    'disbursement_credit_transfer_association_table',
    db.Model.metadata,
    db.Column('disbursement_id', db.Integer, db.ForeignKey('disbursement.id'), index=True),
    db.Column('credit_transfer_id', db.Integer, db.ForeignKey('credit_transfer.id'), index=True)
)

organisation_association_table = db.Table(
    'organisation_association_table',
    db.Model.metadata,
    db.Column('organisation_id', db.Integer, db.ForeignKey('organisation.id'), index=True),
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), index=True),
    db.Column('transfer_account_id', db.Integer, db.ForeignKey('transfer_account.id'), index=True),
    db.Column('credit_transfer_id', db.Integer, db.ForeignKey('credit_transfer.id'), index=True),
)

exchange_contract_token_association_table = db.Table(
    'exchange_contract_token_association_table',
    db.Model.metadata,
    db.Column('exchange_contract_id', db.Integer, db.ForeignKey("exchange_contract.id")),
    db.Column('token_id', db.Integer, db.ForeignKey('token.id'))
)


class ModelBase(db.Model):
    __abstract__ = True

    id = db.Column(db.Integer, primary_key=True, index=True)
    authorising_user_id = db.Column(db.Integer, default=get_authorising_user_id)
    created = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


from server.models.worker_messages import WorkerMessages
class BlockchainTaskableBase(ModelBase):

    __abstract__ = True

    blockchain_task_uuid = db.Column(db.String, index=True)
    blockchain_status   = db.Column(db.Enum(BlockchainStatus), default=BlockchainStatus.PENDING)
    blockchain_hash = db.Column(db.String)
    last_worker_update = db.Column(db.DateTime)
    @declared_attr
    def messages(cls):
        return db.relationship('WorkerMessages', primaryjoin=lambda: db.foreign(WorkerMessages.blockchain_task_uuid)==cls.blockchain_task_uuid, lazy=True)


class SoftDelete(object):

    _deleted = db.Column(db.DateTime)

    @hybrid_property
    def deleted(self):
        return self._deleted

    @deleted.setter
    def deleted(self, deleted):
        if self._deleted:
            raise ResourceAlreadyDeletedError('Resource Already Deleted')
        self._deleted = deleted


class OneOrgBase(object):
    is_public = db.Column(db.Boolean, default=False, index=True)

    @declared_attr
    def organisation_id(cls):
        return db.Column('organisation_id', db.ForeignKey('organisation.id'))
class ManyOrgBase(object):

    is_public = db.Column(db.Boolean, default=False, index=True)

    @declared_attr
    def organisations(cls):
        # pluralisation
        name = cls.__tablename__.lower()
        plural = name + 's'
        if name[-1] in ['s', 'sh', 'ch', 'x']:
            # exceptions to this rule...
            plural = name + 'es'
        return db.relationship("Organisation",
                               secondary=organisation_association_table,
                               back_populates=plural,
                               lazy='joined')


def paginate_query(query, sort_attribute=None, sort_desc=True, ignore_last_fetched=False):

    updated_after = request.args.get('updated_after')
    per_page = request.args.get('per_page')
    page = request.args.get('page')
    last_fetched = request.args.get('last_fetched')

    queried_object = query._primary_entity.mapper.class_

    if updated_after:
        parsed_time = parser.isoparse(updated_after)
        query = query.filter(queried_object.updated > parsed_time)

    if not sort_attribute:
        sort_attribute = queried_object.id

    if sort_attribute.expression.comparator.type.python_type == datetime.datetime and last_fetched:
        last_fetched = parser.isoparse(last_fetched)

    if sort_desc:
        query = query.order_by(sort_attribute.desc())
        if last_fetched:
            query = query.filter(sort_attribute < last_fetched)

    else:
        query = query.order_by(sort_attribute.asc())
        if last_fetched:
            query = query.filter(sort_attribute > last_fetched)

    if per_page is None:
        items = query.all()

        if len (items) > 0 and not ignore_last_fetched:
            new_last_fetched_obj = items[-1]
            new_last_fetched = getattr(new_last_fetched_obj, sort_attribute.key)
        else:
            new_last_fetched = None

        return items, len(items), 1, new_last_fetched

    per_page = int(per_page)

    if page is None:
        paginated = query.paginate(0, per_page, error_out=False)
    else:

        page = int(page)

        paginated = query.paginate(page, per_page, error_out=False)

    if len(paginated.items) > 0 and not ignore_last_fetched:
        new_last_fetched_obj = paginated.items[-1]
        new_last_fetched = getattr(new_last_fetched_obj, sort_attribute.key)
    else:
        new_last_fetched = None

    return paginated.items, paginated.total, paginated.pages, new_last_fetched