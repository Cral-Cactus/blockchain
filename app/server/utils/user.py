import threading
from functools import cmp_to_key
from typing import Optional, List
from phonenumbers.phonenumberutil import NumberParseException
from sqlalchemy.orm.attributes import flag_modified
from bit import base58
from flask import current_app, g
from eth_utils import to_checksum_address
import sentry_sdk

from server import db
from server.models.device_info import DeviceInfo
from server.models.organisation import Organisation
from server.models.token import Token
from server.models.transfer_usage import TransferUsage
from server.models.upload import UploadedResource
from server.models.user import User
from server.models.custom_attribute_user_storage import CustomAttributeUserStorage
from server.models.custom_attribute import CustomAttribute
from server.models.transfer_card import TransferCard
from server.models.transfer_account import TransferAccount, TransferAccountType
from server.models.blockchain_address import BlockchainAddress
from server.schemas import user_schema
from server.constants import DEFAULT_ATTRIBUTES, KOBO_META_ATTRIBUTES, ASSIGNABLE_TIERS
from server.exceptions import PhoneVerificationError, TransferAccountNotFoundError
from server import celery_app
from server.utils.phone import send_message, send_translated_message
from server.utils.phone import proccess_phone_number
from server.utils.amazon_s3 import generate_new_filename, save_to_s3_from_url, LoadFileException
from server.utils.internationalization import i18n_for
from server.utils.misc import rounded_dollars
from server.utils.multi_chain import get_chain
from server.utils.audit_history import manually_add_history_entry

def save_photo_and_check_for_duplicate(url, new_filename, image_id):
    save_to_s3_from_url(url, new_filename)

    try:
        rekognition_task = celery_app.signature('worker.celery_tasks.check_for_duplicate_person',
                                                args=(new_filename, image_id))
        # TODO: Standardize this task (pipe through execute_synchronous_celery)
        rekognition_task.delay()
    except Exception as e:
        print(e)
        sentry_sdk.capture_exception(e)
        pass


def find_oldest_user_for_transfer_account(transfer_account):
    oldest_user = None
    for user in transfer_account.user:
        if oldest_user:
            if user.created < oldest_user.created:
                oldest_user = user
        else:
            oldest_user = user

    return oldest_user


def find_user_from_public_identifier(*public_identifiers):
    """
    :param public_identifiers: email, phone, public_serial_number, nfc_serial_number or address
    :return: First user found
    """
    user = None
    transfer_card = None

    for public_identifier in list(filter(lambda x: x is not None, public_identifiers)):
        if public_identifier is None:
            continue

        user = User.query.execution_options(show_all=True).filter_by(
            email=str(public_identifier).lower()).first()
        if user:
            break

        try:
            user = User.query.execution_options(show_all=True).filter_by(
                phone=proccess_phone_number(public_identifier)).first()
            if user:
                break
        except NumberParseException:
            pass

        transfer_card = TransferCard.query.execution_options(show_all=True).filter_by(
            public_serial_number=str(public_identifier).lower()).first()
        user = transfer_card and transfer_card.user

        if user:
            break

        transfer_card = TransferCard.query.execution_options(show_all=True).filter_by(
            nfc_serial_number=public_identifier.upper()).first()
        user = transfer_card and transfer_card.user

        if user:
            break

        user = User.query.execution_options(show_all=True).filter_by(
            uuid=public_identifier).first()
        if user:
            break

        try:
            checksummed = to_checksum_address(public_identifier)
            blockchain_address = BlockchainAddress.query.filter_by(
                address=checksummed).first()

            if blockchain_address and blockchain_address.transfer_account:
                user = blockchain_address.transfer_account.primary_user
                if user:
                    break

        except Exception:
            pass

    return user, transfer_card


def update_transfer_account_user(user,
                                 first_name=None, last_name=None, preferred_language=None,
                                 phone=None, email=None, public_serial_number=None,
                                 use_precreated_pin=False,
                                 existing_transfer_account=None,
                                 roles=None,
                                 default_organisation_id=None,
                                 business_usage=None):
    if first_name:
        user.first_name = first_name
    if last_name:
        user.last_name = last_name
    if preferred_language:
        user.preferred_language = preferred_language
    if phone:
        user.phone = phone
    if email:
        user.email = email
    if public_serial_number:
        user.public_serial_number = public_serial_number
        transfer_card = TransferCard.get_transfer_card(public_serial_number)
        user.default_transfer_account.transfer_card = transfer_card
        if transfer_card:
            transfer_card.update_transfer_card()
    else:
        transfer_card = None

    if default_organisation_id:
        user.default_organisation_id = default_organisation_id

    if use_precreated_pin and transfer_card:
        user.set_pin(transfer_card.PIN)

    if existing_transfer_account:
        user.transfer_accounts.append(existing_transfer_account)
    if business_usage:
        if business_usage != user.business_usage:
            name = user.business_usage.name if user.business_usage else None
            manually_add_history_entry('user', user.id, 'Business Usage', name, business_usage.name)
        user.business_usage_id = business_usage.id

    # remove all roles before updating
    user.remove_all_held_roles()

    if roles:
        for role in roles:
            user.set_held_role(role[0], role[1])

    return user


def create_transfer_account_user(first_name=None, last_name=None, preferred_language=None,
                                 phone=None, email=None, public_serial_number=None, uuid=None,
                                 organisation: Organisation=None,
                                 token=None,
                                 blockchain_address=None,
                                 transfer_account_name=None,
                                 use_precreated_pin=False,
                                 use_last_4_digits_of_id_as_initial_pin=False,
                                 existing_transfer_account=None,
                                 roles=None,
                                 is_self_sign_up=False,
                                 business_usage=None,
                                 initial_disbursement=None):

    user = User(first_name=first_name,
                last_name=last_name,
                preferred_language=preferred_language,
                blockchain_address=blockchain_address,
                phone=phone,
                email=email,
                uuid=uuid,
                public_serial_number=public_serial_number,
                is_self_sign_up=is_self_sign_up,
                business_usage=business_usage)

    precreated_pin = None
    is_activated = False

    try:
        transfer_card = TransferCard.get_transfer_card(public_serial_number)
    except Exception as e:
        transfer_card = None

    if use_precreated_pin:
        precreated_pin = transfer_card.PIN
        is_activated = True

    elif use_last_4_digits_of_id_as_initial_pin:
        precreated_pin = str(public_serial_number or phone)[-4:]
        is_activated = False

    user.set_pin(precreated_pin, is_activated)

    if roles:
        for role in roles:
            user.set_held_role(role[0], role[1])
    else:
        user.remove_all_held_roles()

    if not organisation:
        organisation = Organisation.master_organisation()

    user.add_user_to_organisation(organisation, is_admin=False)

    db.session.add(user)

    if existing_transfer_account:
        transfer_account = existing_transfer_account
        user.transfer_accounts.append(existing_transfer_account)
    else:
        transfer_account = TransferAccount(
            bound_entity=user,
            blockchain_address=blockchain_address,
            organisation=organisation
        )

        top_level_roles = [r[0] for r in roles or []]
        is_vendor = 'VENDOR' in top_level_roles
        is_beneficiary = 'BENEFICIARY' in top_level_roles

        transfer_account.name = transfer_account_name
        transfer_account.is_vendor = is_vendor
        transfer_account.is_beneficiary = is_beneficiary

        if transfer_card:
            transfer_account.transfer_card = transfer_card

        if token:
            transfer_account.token = token

        if not is_self_sign_up:
            transfer_account.approve_and_disburse(initial_disbursement=initial_disbursement)

        db.session.add(transfer_account)

    user.default_transfer_account = transfer_account

    return user

def save_device_info(device_info, user):
    add_device = False

    if device_info['uniqueId'] and not DeviceInfo.query.filter_by(
            unique_id=device_info['uniqueId']).first():
        # Add the device if the uniqueId is defined, and isn't already in db
        add_device = True

    if add_device:
        device = DeviceInfo()

        device.unique_id = device_info['uniqueId']
        device.brand = device_info['brand']
        device.model = device_info['model']
        device.width = device_info['width']
        device.height = device_info['height']
        send_translated_message(user, 'new_device', brand=device.brand, model=device.model)
        device.user = user

        db.session.add(device)

        return device


def set_custom_attributes(attribute_dict, user):
    # loads in any existing custom attributes
    custom_attributes = user.custom_attributes or []
    for key in attribute_dict['custom_attributes'].keys():
        custom_attribute = CustomAttribute.query.filter(CustomAttribute.name == key).first()
        if not custom_attribute:
            custom_attribute = CustomAttribute()
            custom_attribute.name = key
            db.session.add(custom_attribute)

        # Put validation logic here!
        value = attribute_dict['custom_attributes'][key]
        value = custom_attribute.clean_and_validate_custom_attribute(value)
        
        to_remove = list(filter(lambda a: a.custom_attribute.name == key, custom_attributes))
        for r in to_remove:
            manually_add_history_entry('user', user.id, key, r.value, value)
            custom_attributes.remove(r)
            db.session.delete(r)
        custom_attribute = CustomAttributeUserStorage(
            custom_attribute=custom_attribute, value=value)

        custom_attributes.append(custom_attribute)
    custom_attributes = set_attachments(
        attribute_dict, user, custom_attributes)
    user.custom_attributes = custom_attributes
    return custom_attributes