import phonenumbers
import enum
import sentry_sdk

from flask import current_app, g
from server import twilio_client, messagebird_client, africastalking_client
from server.utils.executor import standard_executor_job
from server.utils.internationalization import i18n_for

def proccess_phone_number(phone_number, region=None, ignore_region=False):
    """
    Parse any given phone number.
    :param phone_number: int
    :param region: ISO 3166-1 alpha-2 codes
    :param ignore_region: Boolean. True returns original phone
    :return:
    """
    from server.models.organisation import Organisation

    if phone_number is None:
        return None

    if ignore_region:
        return phone_number

    if region is None:
        try:
            region = g.active_organisation.country_code
        except AttributeError:
            region = Organisation.master_organisation().country_code

    if not isinstance(phone_number, str):
        try:
            phone_number = str(int(phone_number))

        except ValueError:
            pass

    phone_number_object = phonenumbers.parse(phone_number, region)

    parsed_phone_number = phonenumbers.format_number(phone_number_object, phonenumbers.PhoneNumberFormat.E164)

    return parsed_phone_number


class ChannelType(enum.Enum):
    TWILIO = "tw"
    AFRICAS_TALKING = "at"
    MESSAGEBIRD = "mb"

# just checking by area code may break down one day since multiple countries share the same country codes...
def channel_for_number(phone):
    if phone.startswith("+1"):
        return ChannelType.TWILIO
    if phone.startswith("+254"):
        return ChannelType.AFRICAS_TALKING
    else:
        # what should fallback be?
        return ChannelType.TWILIO

@standard_executor_job
def _send_twilio_message(to_phone, message):
    if to_phone:
        twilio_client.api.account.messages.create(
            to=to_phone,
            from_=current_app.config['TWILIO_PHONE'],
            body=message)

@standard_executor_job
def _send_messagebird_message(to_phone, message):
    if to_phone:
        messagebird_client.message_create(current_app.config['MESSAGEBIRD_PHONE'], to_phone, message)