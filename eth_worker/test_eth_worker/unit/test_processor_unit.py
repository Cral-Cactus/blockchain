import pytest

from mocks import MockUnbuiltTransaction


def test_get_gas_price(processor):
    assert processor._get_gas_price() == 100

# def test_call_contract_function(processor):
#     processor.call_contract_function()


# Actually
def test_calculate_nonce(dummy_transaction, second_dummy_transaction, noncer, processor):
    wallet = dummy_transaction.signing_wallet

    noncer.increment_counter(dummy_transaction.signing_wallet.address)
    assert processor._calculate_nonce(wallet, dummy_transaction.id) == 1

    # Shouldn't change since it's the same transaction
    noncer.increment_counter(dummy_transaction.signing_wallet.address)
    assert processor._calculate_nonce(wallet, dummy_transaction.id) == 1

    noncer.increment_counter(dummy_transaction.signing_wallet.address)
    assert processor._calculate_nonce(wallet, second_dummy_transaction.id) == 3


@pytest.mark.parametrize("unbuilt_transaction, gas_limit, gas_price, expected", [
    (MockUnbuiltTransaction(), None, 123456, {'gas': 100000, 'gasPrice': 123456, 'nonce': 0, 'chainId': 1}),
    (MockUnbuiltTransaction(), 654321, None, {'gas': 654321, 'gasPrice': 100, 'nonce': 0, 'chainId': 1}),
    (MockUnbuiltTransaction(), 654321, 123456, {'gas': 654321, 'gasPrice': 123456, 'nonce': 0, 'chainId': 1}),
    (None, 654321, 123456, {'gas': 654321, 'gasPrice': 123456, 'nonce': 0, 'chainId': 1}),
    (None, None, 123456, None),
    (None, None, None, None),

])
def test_compile_transaction_metadata(dummy_transaction, processor, unbuilt_transaction, gas_limit, gas_price, expected):

    if expected:
        metadata = processor._compile_transaction_metadata(
            dummy_transaction.signing_wallet,
            dummy_transaction.id,
            unbuilt_transaction=unbuilt_transaction,
            gas_limit=gas_limit,
            gas_price=gas_price
        )

        assert metadata == expected

    else:
        with pytest.raises(Exception):
            processor._compile_transaction_metadata(
                dummy_transaction.signing_wallet,
                dummy_transaction.id,
                unbuilt_transaction=unbuilt_transaction,
                gas_limit=gas_limit,
                gas_price=gas_price
            )