import pytest, json, config, base64

from server import bt

@pytest.mark.parametrize("contract_address, contract_type, filter_type, filter_parameters, status_code", [
    (config.CHAINS['ETHEREUM']['CONTRACT_ADDRESS'], "ERC20", 'TRANSFER', None, 201),
])

def test_force_recall_webhook(test_client, complete_admin_auth_token):
    response = test_client.post(
        '/api/v1/synchronization_filter/',
        headers=dict(
            Authorization=complete_admin_auth_token,
            Accept='application/json'
        ),
        json={
            'call': 'force_recall_webhook',
            'transaction_hash': '0xdeadbeef2322d396649ed2fa2b7e0a944474b65cfab2c4b1435c81bb16697ecb',
        })

    assert response.status_code == 201