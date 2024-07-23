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

def test_proccess_deploy_contract_transaction(processor, dummy_transaction, mock_txn_send):

    processor.process_deploy_contract_transaction(
        dummy_transaction.id, 'ERC20Token', args=('FooToken', 'FTK', 18)
    )

    sent_data = dict(mock_txn_send.sent_txns[0])

    assert sent_data == {
        'value': 0,
        'gas': 40000,
        'gasPrice': 100,
        'nonce': 0,
        'chainId': 1,
        # web3.py generated, so not much point introspecting this in the functional test
        'data': '0x60c0604052600960808190527f546f6b656e20302e31000000000000000000000000000000000000000000000060a090815261003e9160009190610124565b5060408051602081019182905260009081905261005d91600191610124565b5060408051602081019182905260009081905261007c91600291610124565b506003805460ff19169055600060045534801561009857600080fd5b506040516109aa3803806109aa833981016040908152815160208301519183015190830180519093929092019160001080156100d5575060008251115b15156100e057600080fd5b82516100f3906001906020860190610124565b508151610107906002906020850190610124565b506003805460ff191660ff92909216919091179055506101bf9050565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f1061016557805160ff1916838001178555610192565b82800160010185558215610192579182015b82811115610192578251825591602001919060010190610177565b5061019e9291506101a2565b5090565b6101bc91905b8082111561019e57600081556001016101a8565b90565b6107dc806101ce6000396000f3006080604052600436106100a35763ffffffff7c010000000000000000000000000000000000000000000000000000000060003504166306fdde0381146100a8578063095ea7b31461013257806318160ddd1461016a57806323b872dd14610191578063313ce567146101bb5780635a3b7e42146101e657806370a08231146101fb57806395d89b411461021c578063a9059cbb14610231578063dd62ed3e14610255575b600080fd5b3480156100b457600080fd5b506100bd61027c565b6040805160208082528351818301528351919283929083019185019080838360005b838110156100f75781810151838201526020016100df565b50505050905090810190601f1680156101245780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34801561013e57600080fd5b50610156600160a060020a0360043516602435610309565b604080519115158252519081900360200190f35b34801561017657600080fd5b5061017f6103c2565b60408051918252519081900360200190f35b34801561019d57600080fd5b50610156600160a060020a03600435811690602435166044356103c8565b3480156101c757600080fd5b506101d0610575565b6040805160ff9092168252519081900360200190f35b3480156101f257600080fd5b506100bd61057e565b34801561020757600080fd5b5061017f600160a060020a03600435166105d9565b34801561022857600080fd5b506100bd6105eb565b34801561023d57600080fd5b50610156600160a060020a0360043516602435610643565b34801561026157600080fd5b5061017f600160a060020a0360043581169060243516610745565b60018054604080516020600284861615610100026000190190941693909304601f810184900484028201840190925281815292918301828280156103015780601f106102d657610100808354040283529160200191610301565b820191906000526020600020905b8154815290600101906020018083116102e457829003601f168201915b505050505081565b600082600160a060020a038116151561035a576040805160e560020a62461bcd0281526020600482018190526024820152600080516020610791833981519152604482015290519081900360640190fd5b336000818152600660209081526040808320600160a060020a03891680855290835292819020879055805187815290519293927f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925929181900390910190a35060019392505050565b60045481565b600083600160a060020a0381161515610419576040805160e560020a62461bcd0281526020600482018190526024820152600080516020610791833981519152604482015290519081900360640190fd5b83600160a060020a0381161515610468576040805160e560020a62461bcd0281526020600482018190526024820152600080516020610791833981519152604482015290519081900360640190fd5b600160a060020a038616600090815260066020908152604080832033845290915290205461049c908563ffffffff61076216565b600160a060020a0387166000818152600660209081526040808320338452825280832094909455918152600590915220546104dd908563ffffffff61076216565b600160a060020a038088166000908152600560205260408082209390935590871681522054610512908563ffffffff61077716565b600160a060020a0380871660008181526005602090815260409182902094909455805188815290519193928a16927fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef92918290030190a350600195945050505050565b60035460ff1681565b6000805460408051602060026001851615610100026000190190941693909304601f810184900484028201840190925281815292918301828280156103015780601f106102d657610100808354040283529160200191610301565b60056020526000908152604090205481565b6002805460408051602060018416156101000260001901909316849004601f810184900484028201840190925281815292918301828280156103015780601f106102d657610100808354040283529160200191610301565b600082600160a060020a0381161515610694576040805160e560020a62461bcd0281526020600482018190526024820152600080516020610791833981519152604482015290519081900360640190fd5b336000908152600560205260409020546106b4908463ffffffff61076216565b3360009081526005602052604080822092909255600160a060020a038616815220546106e6908463ffffffff61077716565b600160a060020a0385166000818152600560209081526040918290209390935580518681529051919233927fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef9281900390910190a35060019392505050565b600660209081526000928352604080842090915290825290205481565b60008183101561077157600080fd5b50900390565b60008282018381101561078957600080fd5b939250505056004d7573742062652076616c69642c206e6f74206e756c6c20616464726573732ea165627a7a723058208274d76436e876b25cefbbbe144b27353a212b50d2b70270b8ad9e2978ea5f550029000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000008466f6f546f6b656e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000346544b0000000000000000000000000000000000000000000000000000000000',
        'to': b''
    }


@pytest.mark.xfail(reason="Mocking out 'call' is a pain, so not working yet")
def test_call_contract_function(processor, mock_txn_send):
    call_data = processor.call_contract_function(
        deterministic_address_1,
        'ERC20',
        'transfer',
        args=(deterministic_address_2, 987654)
    )