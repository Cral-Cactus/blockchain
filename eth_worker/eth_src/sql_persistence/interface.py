import datetime
from typing import Tuple
from sqlalchemy import and_, or_
from sqlalchemy.sql import func

from stengo_types import UUID, UUIDList

from celery_utils import chain
import config

from sql_persistence.models import (
    BlockchainTransaction,
    BlockchainTask,
    BlockchainWallet,
    SynchronizationFilter
)

from exceptions import (
    WalletExistsError
)

class SQLPersistenceInterface(object):

    def _fail_expired_transactions(self):
        expire_time = datetime.datetime.utcnow() - datetime.timedelta(
            seconds=self.PENDING_TRANSACTION_EXPIRY_SECONDS
        )

        (self.session.query(BlockchainTransaction)
         .filter(and_(BlockchainTransaction.status == 'PENDING',
                      BlockchainTransaction.updated < expire_time))
         .update({BlockchainTransaction.status: 'FAILED',
                  BlockchainTransaction.error: 'Timeout Error'},
                 synchronize_session=False))

    def _unconsume_high_failed_nonces(self, signing_wallet_id, stating_nonce):
        expire_time = datetime.datetime.utcnow() - datetime.timedelta(
            seconds=self.PENDING_TRANSACTION_EXPIRY_SECONDS
        )

        highest_known_success = (self.session.query(BlockchainTransaction)
                                 .filter(and_(BlockchainTransaction.signing_wallet_id == signing_wallet_id,
                                              BlockchainTransaction.status == 'SUCCESS'))
                                 .order_by(BlockchainTransaction.id.desc()).first()
                                 )

        if highest_known_success:
            highest_known_nonce = highest_known_success.nonce or 0
        else:
            highest_known_nonce = 0

        nonce = max(stating_nonce, highest_known_nonce)

        (self.session.query(BlockchainTransaction)
         .filter(and_(BlockchainTransaction.signing_wallet_id == signing_wallet_id,
                      BlockchainTransaction.status == 'FAILED',
                      BlockchainTransaction.nonce > nonce,
                      BlockchainTransaction.submitted_date < expire_time))
         .update({BlockchainTransaction.nonce_consumed: False},
                 synchronize_session=False))

    def _calculate_nonce(self, signing_wallet_obj, starting_nonce=0):

        self._unconsume_high_failed_nonces(signing_wallet_obj.id, starting_nonce)
        self._fail_expired_transactions()

        # First find the highest *continuous* nonce that isn't either pending, or consumed
        # (failed or succeeded on blockchain)

        likely_consumed_nonces = (
            self.session.query(BlockchainTransaction)
                .filter(BlockchainTransaction.signing_wallet == signing_wallet_obj)
                .filter(BlockchainTransaction.ignore == False)
                .filter(BlockchainTransaction.first_block_hash == self.first_block_hash)
                .filter(
                    and_(
                        or_(BlockchainTransaction.status == 'PENDING',
                            BlockchainTransaction.nonce_consumed == True),
                        BlockchainTransaction.nonce >= starting_nonce
                    )
                )
                .all())

        # Use a set to find continous nonces because txns in db may be out of order
        nonce_set = set()
        for txn in likely_consumed_nonces:
            nonce_set.add(txn.nonce)

        next_nonce = starting_nonce
        while next_nonce in nonce_set:
            next_nonce += 1

        return next_nonce

    def locked_claim_transaction_nonce(
            self,
            network_nonce,
            signing_wallet_id: int,
            transaction_id: int
    ) -> int:
        """
        Claim a transaction a nonce for a particular transaction, using a lock to prevent another transaction
        from accidentially claiming the same nonce.

        :param network_nonce: the highest nonce that we know has been claimed on chain
        :param signing_wallet_id: the wallet object that will be used to sign the transaction
        :param transaction_id: the id of the transaction object
        :return: a tuple of the claimed nonce, and the transaction_id (transaction_id is passed through for chaining)
        """

        signing_wallet = self.session.query(BlockchainWallet).get(signing_wallet_id)
        transaction = self.session.query(BlockchainTransaction).get(transaction_id)

        lock = self.red.lock(signing_wallet.address, timeout=600)
        print(f'Attempting lock for txn: {transaction_id} \n'
              f'addr:{signing_wallet.address}')
        # Commits here are because the database would sometimes timeout during a long lock
        # and could not cleanly restart with uncommitted data in the session. Committing before
        # the lock, and then once it's reclaimed lets the session gracefully refresh if it has to.
        self.session.commit()
        with lock:
            self.session.commit()
            self.session.refresh(signing_wallet)

            nonce = self._claim_transaction_nonce(network_nonce, signing_wallet, transaction)
            return nonce

    def _claim_transaction_nonce(
            self,
            network_nonce: int,
            signing_wallet: BlockchainWallet,
            transaction: BlockchainTransaction,
    ) -> int:

        if transaction.nonce is not None:
            return transaction.nonce
        calculated_nonce = self._calculate_nonce(signing_wallet, network_nonce)
        transaction.signing_wallet = signing_wallet
        transaction.nonce = calculated_nonce
        transaction.status = 'PENDING'

        # TODO: can we shift this commit out?
        self.session.commit()

        return calculated_nonce

    def update_transaction_data(self, transaction_id, transaction_data):
        transaction = self.session.query(BlockchainTransaction).get(transaction_id)

        for attribute in transaction_data:
            if transaction_data[attribute] != getattr(transaction, attribute):
                setattr(transaction, attribute, transaction_data[attribute])
        self.session.commit()

    def create_blockchain_transaction(self, task_uuid):

        task = self.session.query(BlockchainTask).filter_by(uuid=task_uuid).first()

        blockchain_transaction = BlockchainTransaction(
            signing_wallet=task.signing_wallet,
            first_block_hash=self.first_block_hash
        )

        self.session.add(blockchain_transaction)

        if task:
            # TODO: when is this ever not the case?
            # We should just force signing walelt based off the task
            blockchain_transaction.task = task

        self.session.commit()

        return blockchain_transaction

    # Gets transaction using transaction_id OR hash
    def get_transaction(self, transaction_id = None, hash = None):
        if transaction_id:
            return self.session.query(BlockchainTransaction).get(transaction_id)
        else:
            return self.session.query(BlockchainTransaction).filter_by(hash=hash).first()
    
    def get_transaction_signing_wallet(self, transaction_id):

        transaction = self.session.query(BlockchainTransaction).get(transaction_id)

        return transaction.signing_wallet

    def set_task_status_text(self, task, text):
        task.status_text = text
        self.session.commit()

    def create_send_eth_task(self,
                             uuid: UUID,
                             signing_wallet_obj,
                             recipient_address, amount_wei,
                             prior_tasks=None,
                             posterior_tasks=None):

        task = BlockchainTask(uuid,
                              signing_wallet=signing_wallet_obj,
                              type='SEND_ETH',
                              is_send_eth=True,
                              recipient_address=recipient_address,
                              amount=amount_wei,
                              prior_tasks=prior_tasks,
                              posterior_tasks=posterior_tasks)

        self.session.add(task)
        self.session.commit()

        return task

    def create_deploy_contract_task(self,
                                    uuid: UUID,
                                    signing_wallet_obj,
                                    contract_name,
                                    args=None, kwargs=None,
                                    gas_limit=None,
                                    prior_tasks=None, posterior_tasks=None):

        task = BlockchainTask(uuid,
                              signing_wallet=signing_wallet_obj,
                              type='DEPLOY_CONTRACT',
                              contract_name=contract_name,
                              args=args,
                              kwargs=kwargs,
                              gas_limit=gas_limit,
                              prior_tasks=prior_tasks,
                              posterior_tasks=posterior_tasks)

        self.session.add(task)
        self.session.commit()

        return task

    def create_function_task(self,
                             uuid: UUID,
                             signing_wallet_obj,
                             contract_address, abi_type,
                             function_name, args=None, kwargs=None,
                             gas_limit=None,
                             prior_tasks=None, posterior_tasks=None,
                             reverses_task=None):


        task = BlockchainTask(uuid,
                              signing_wallet=signing_wallet_obj,
                              type='FUNCTION',
                              contract_address=contract_address,
                              abi_type=abi_type,
                              function=function_name,
                              args=args,
                              kwargs=kwargs,
                              gas_limit=gas_limit,
                              prior_tasks=prior_tasks,
                              posterior_tasks=posterior_tasks)

        self.session.add(task)

        if reverses_task:
            reverses_task_obj = self.get_task_from_uuid(reverses_task)
            if reverses_task_obj:
                task.reverses = reverses_task_obj

                self.session.commit()

                # Release the multithread lock
                self.red.delete(f'MultithreadDupeLock-{reverses_task_obj.id}')

        self.session.commit()

        return task

    def remove_prior_task_dependency(self, task_uuid: UUID, prior_task_uuid: UUID):

        task = self.get_task_from_uuid(task_uuid=task_uuid)
        prior_task = self.get_task_from_uuid(task_uuid=prior_task_uuid)
        if task and prior_task:
            try:
                task.prior_tasks.remove(prior_task)
                self.session.commit()
            except ValueError:
                pass

    def remove_all_posterior_dependencies(self, prior_task_uuid: UUID) -> UUIDList:
        prior_task = self.get_task_from_uuid(task_uuid=prior_task_uuid)

        posterior_task_uuids = [t.uuid for t in prior_task.posterior_tasks]

        prior_task.posterior_tasks = []

        self.session.commit()

        return posterior_task_uuids

    def increment_task_invocations(self, task_uuid: UUID):

        task = self.get_task_from_uuid(task_uuid=task_uuid)
        if task:
            task.previous_invocations = (task.previous_invocations or 0) + 1
            self.session.commit()

    def get_serialised_task_from_uuid(self, uuid):
        task = self.get_task_from_uuid(uuid)

        if task is None:
            return None

        base_data = {
            'id': task.id,
            'status': task.status,
            'prior_tasks': [task.uuid for task in task.prior_tasks],
            'posterior_tasks': [task.uuid for task in task.posterior_tasks],
            'transactions': [transaction.id for transaction in task.transactions]
        }

        if task.successful_transaction:

            transaction_data = {
                'successful_hash': task.successful_transaction.hash,
                'successful_block': task.successful_transaction.block,
                'contract_address': task.successful_transaction.contract_address
            }

            return {**transaction_data, **base_data}

        else:
            return base_data