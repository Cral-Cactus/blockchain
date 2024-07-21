from functools import partial
from toolz import pipe
import datetime
from celery import signature

import config
from celery_app import persistence_module, w3, red, task_manager, processor, chain_config
from eth_src import celery_utils

timeout = chain_config['SYNCRONOUS_TASK_TIMEOUT']

def call_contract_function(contract_address, contract_type, func, args=None):
    sig = processor.sigs.call_contract_function(contract_address, contract_type, func, args)
    return celery_utils.execute_synchronous_celery(sig)


def deploy_contract_task(signing_address, contract_name, args=None, prior_tasks=None):
    sig = task_manager.sigs.deploy_contract_task(signing_address, contract_name, args, prior_tasks)
    return celery_utils.queue_sig(sig)

def transact_with_function_task(
        signing_address,
        contract_address, contract_type,
        func, args=None,
        gas_limit=None,
        prior_tasks=None,
        reverses_task=None
):
    sig = task_manager.sigs.transact_with_function_task(
        signing_address,
        contract_address,
        contract_type,
        func,
        args,
        gas_limit,
        prior_tasks,
        reverses_task
    )
    return celery_utils.queue_sig(sig)

def send_eth_task(signing_address, amount_wei, recipient_address):
    sig = task_manager.sigs.send_eth_task(signing_address, amount_wei, recipient_address)
    return celery_utils.queue_sig(sig)

def get_wallet_balance(address, token_address):

    balance_wei = call_contract_function(
        contract_address=token_address,
        contract_type='ERC20',
        func='balanceOf',
        args=[address])

    return balance_wei


def get_contract_address(task_uuid):
    await_tr = partial(celery_utils.await_blockchain_success, timeout=timeout)
    return pipe(task_uuid, await_tr, lambda r: r.get('contract_address'))


def topup_wallets(queue='low-priority'):
    wallets = persistence_module.get_all_wallets()

    for wallet in wallets:
        if (wallet.wei_topup_threshold or 0) > 0:

            last_topup_task_uuid = wallet.last_topup_task_uuid

            if last_topup_task_uuid:
                task = persistence_module.get_task_from_uuid(last_topup_task_uuid)

                if task and task.status in ['PENDING', 'UNSTARTED']:
                    return

            signature(celery_utils.eth_endpoint('topup_wallet_if_required'),
                      kwargs={
                          'address': wallet.address
                      }).delay()


def topup_if_required(address):
    balance = w3.eth.getBalance(address)

    wallet = persistence_module.get_wallet_by_address(address)
    wei_topup_threshold = wallet.wei_topup_threshold
    wei_target_balance = wallet.wei_target_balance or 0

    if balance <= wei_topup_threshold and wei_target_balance > balance:
        sig = signature(celery_utils.eth_endpoint('send_eth'),
                        kwargs={
                            'signing_address': chain_config['MASTER_WALLET_ADDRESS'],
                            'amount_wei': wei_target_balance - balance,
                            'recipient_address': address,
                            'prior_tasks': []
                        })

        task_uuid = celery_utils.queue_sig(sig)

        persistence_module.set_wallet_last_topup_task_uuid(address, task_uuid)

        return task_uuid

    return None


def deploy_exchange_network(deploying_address):
    gasPrice = int(2.5e11)

    def deployer(contract_name, args=None):
        return deploy_contract_task(deploying_address, contract_name, args)

    def register_contract(task_uuid, name):

        contract_to_be_registered_id = call_contract_function(
            contract_address=id_contract_address,
            contract_type='ContractIds',
            func=name
        )

        task = celery_utils.await_blockchain_success(task_uuid, timeout=timeout)
        contract_address = task['contract_address']

        return transact_with_function_task(
            signing_address=deploying_address,
            contract_address=registry_contract_address,
            contract_type='ContractRegistry',
            func='registerAddress',
            args=[
                {'type': 'bytes', 'data': contract_to_be_registered_id},
                contract_address
            ],
            gas_limit=8000000
        )

    reg_deploy = deployer(contract_name='ContractRegistry')
    ids_deploy = deployer(contract_name='ContractIds')

    registry_contract_address = get_contract_address(reg_deploy)
    id_contract_address = get_contract_address(ids_deploy)

    features_deploy = deployer(contract_name='ContractFeatures')

    price_limit_deploy = deployer(contract_name='BancorGasPriceLimit',
                                  args=[gasPrice])

    formula_deploy = deployer(contract_name='BancorFormula')

    nst_reg_deploy = deployer(contract_name='NonStandardTokenRegistry')

    network_deploy = deployer(contract_name='BancorNetwork',
                              args=[registry_contract_address])

    # factory_deploy = deployer(contract_name='BancorConverterFactory')

    factory_upgrader_deploy = deployer(contract_name='BancorConverterUpgrader',
                                       args=[registry_contract_address])

    register_contract(features_deploy, 'CONTRACT_FEATURES')
    register_contract(price_limit_deploy, 'BANCOR_GAS_PRICE_LIMIT')
    register_contract(formula_deploy, 'BANCOR_FORMULA')
    register_contract(nst_reg_deploy, 'NON_STANDARD_TOKEN_REGISTRY')
    register_contract(network_deploy, 'BANCOR_NETWORK')
    # register_contract(factory_deploy, 'BANCOR_CONVERTER_FACTORY')
    register_contract(factory_upgrader_deploy, 'BANCOR_CONVERTER_UPGRADER')

    network_address = get_contract_address(network_deploy)

    set_signer_task = transact_with_function_task(
        signing_address=deploying_address,
        contract_address=network_address,
        contract_type='BancorNetwork',
        func='setSignerAddress',
        args=[deploying_address],
        gas_limit=8000000
    )

    res = celery_utils.await_blockchain_success(set_signer_task, timeout=timeout)

    return registry_contract_address


def deploy_and_fund_reserve_token(deploying_address, name, symbol, fund_amount_wei):

    deploy_task_uuid = deploy_contract_task(
        deploying_address,
        'WrappedDai',
        [name, symbol]
    )

    reserve_token_address = get_contract_address(deploy_task_uuid)

    send_eth_task_id = send_eth_task(deploying_address, fund_amount_wei, reserve_token_address)

    res = celery_utils.await_blockchain_success(send_eth_task_id, timeout=timeout)

    balance = call_contract_function(
        contract_address=reserve_token_address,
        contract_type='WrappedDai',
        func='balanceOf',
        args=[deploying_address]
    )

    print(f'Account balance for {reserve_token_address} is: {balance}')

    return reserve_token_address