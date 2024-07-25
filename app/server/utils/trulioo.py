import requests, config
from requests.auth import HTTPBasicAuth
from server.utils.phone import send_translated_message
from server.models.user import User

def get_callback_url():
    return config.APP_HOST + '/api/trulioo_async/'


def trulioo_auth():
    return HTTPBasicAuth(config.TRULIOO_USER, config.TRULIOO_PASS)


def get_trulioo_countries():
    response = requests.get(config.TRULIOO_HOST + '/configuration/v1/countrycodes/Identity%20Verification/',
                            auth=trulioo_auth())
    return response.json()


def get_trulioo_country_documents(country):
    response = requests.get(config.TRULIOO_HOST + '/configuration/v1/documentTypes/' + country,
                            auth=trulioo_auth())
    return response.json()


def get_trulioo_consents(country):
    response = requests.get(config.TRULIOO_HOST + '/configuration/v1/consents/Identity Verification/' + country,
                            auth=trulioo_auth())

    return response.json()


def get_trulioo_transaction(transaction_id):
    response = requests.get(config.TRULIOO_HOST + '/verifications/v1/transactionrecord/' + transaction_id,
                            auth=trulioo_auth())

    return response.json()


def handle_trulioo_response(response=None, kyc_application=None):
    # Record.RecordStatus = match.  means successful verification
    record_errors = None
    document_errors = None
    phone = None

    user = User.query.get(kyc_application.user_id)
    authenticity_reasons = ["DatacomparisonTooLow", "ExpiredDocument", "ValidationFailure", "LivePhotoNOMatch", "UnclassifiedDocument", "SuspiciousDocument"]

    status = response['Record']['RecordStatus']
    if status == 'match':
        kyc_application.kyc_status = 'VERIFIED'

        if user and user.phone:
            send_translated_message(user, 'general_sms.kyc_approved')

    if status == 'nomatch' or status == 'missing':
        # currently only handle 1 datasource (i.e. document)

        errors = response['Record']['DatasourceResults'][0]['Errors']
        if len(response['Record']['DatasourceResults'][0]['Errors']) > 0:
            record_errors = [error['Code'] for error in errors]