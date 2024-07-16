from server.models import token
from server.models.credit_transfer import CreditTransfer
from server.utils.access_control import AccessControl
from server.utils.transfer_enums import TransferSubTypeEnum


# ~~~~~~SIMPLE CHECKS~~~~~~
def stengo_admin_involved(credit_transfer):
    if credit_transfer.recipient_user and AccessControl.has_sufficient_tier(
            credit_transfer.recipient_user.roles, 'ADMIN', 'stengoadmin'):
        return True

    if credit_transfer.sender_user and AccessControl.has_sufficient_tier(
            credit_transfer.sender_user.roles, 'ADMIN', 'stengoadmin'):
        return True

    return False


def sender_user_exists(credit_transfer: CreditTransfer):
    return credit_transfer.sender_user


def user_has_group_account_role(credit_transfer):
    return credit_transfer.sender_user.has_group_account_role


def user_phone_is_verified(credit_transfer):
    return credit_transfer.sender_user.is_phone_verified


def user_individual_kyc_is_verified(credit_transfer):
    return _sender_matches_kyc_criteria(
        credit_transfer,
        lambda app: app.kyc_status == 'VERIFIED' and app.type == 'INDIVIDUAL' and not app.multiple_documents_verified
    )


def user_business_or_multidoc_kyc_verified(credit_transfer):
    return _sender_matches_kyc_criteria(
        credit_transfer,
        lambda app: app.kyc_status == 'VERIFIED'
                    and (app.type == 'BUSINESS' or app.multiple_documents_verified)
    )


def _sender_matches_kyc_criteria(credit_transfer, criteria):
    if credit_transfer.sender_user is not None:
        matches_criteria = next((app for app in credit_transfer.sender_user.kyc_applications if criteria(app)), None)
        return bool(matches_criteria)
    return False


def token_is_liquid_type(credit_transfer):
    return credit_transfer.token and credit_transfer.token.token_type is token.TokenType.LIQUID


def token_is_reserve_type(credit_transfer):
    return credit_transfer.token and credit_transfer.token.token_type is token.TokenType.RESERVE


def transfer_is_agent_out_subtype(credit_transfer):
    return credit_transfer.transfer_subtype is TransferSubTypeEnum.AGENT_OUT