import pytest

from utils import keypair, deterministic_address_1, deterministic_address_2

def test_process_send_eth_transaction(processor, dummy_transaction, mock_txn_send):

    to_add = keypair()['address']
    processor.process_send_eth_transaction(
        dummy_transaction.id, to_add, 123

    )

    sent_data = dict(mock_txn_send.sent_txns[0])

    assert sent_data == {
        'gas': 100000,
        'gasPrice': 100,
        'nonce': 0,
        'chainId': 1,
        'to': to_add,
        'value': 123
    }

def test_process_function_transaction(processor, dummy_transaction, mock_txn_send):
    processor.process_function_transaction(
        dummy_transaction.id,
        deterministic_address_1,
        'ERC20',
        'transfer',
        args=(deterministic_address_2, 987654)
    )

    sent_data = dict(mock_txn_send.sent_txns[0])

    assert sent_data == {
        'value': 0,
        'gas': 40000,
        'gasPrice': 100,
        'nonce': 0,
        'chainId': 1,
        'to': '0x468F90c5a236130E5D51260A2A5Bfde834C694b6',
        'data': '0xa9059cbb00000000000000000000000068d3ce90d84b4dd8936908afd4079797057996bb00000000000000000000000000000000000000000000000000000000000f1206'
    }