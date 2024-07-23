from flask import Blueprint, request, make_response, jsonify, g, current_app
import config
from flask.views import MethodView
import sentry_sdk
from server import db
# from server import limiter
from phonenumbers.phonenumberutil import NumberParseException
from server.models.user import User
from server.models.organisation import Organisation
from server.models.email_whitelist import EmailWhitelist
from server.models.blacklist_token import BlacklistToken
from server.utils.auth import requires_auth, tfa_logic, show_all, create_user_response_object
from server.utils.access_control import AccessControl
from server.utils import user as UserUtils
from server.utils.rate_limit import rate_limit
from server.utils.phone import proccess_phone_number
from server.utils.amazon_ses import send_reset_email, send_activation_email, send_invite_email, \
    send_invite_email_to_existing_user
from server.utils.misc import decrypt_string, attach_host
from server.utils.multi_chain import get_chain
from sqlalchemy.sql import func
from sqlalchemy.orm.attributes import flag_modified

import random

auth_blueprint = Blueprint('auth', __name__)

class RefreshTokenAPI(MethodView):
    """
    User Refresh Token Resource
    """

    @requires_auth
    def get(self):
        try:

            auth_token = g.user.encode_auth_token()

            response_object = create_user_response_object(g.user, auth_token, 'Token refreshed successfully.')

            # Update the last_seen TS for this user
            g.user.update_last_seen_ts()

            return make_response(jsonify(attach_host(response_object))), 200

        except Exception as e:

            response_object = {
                'status': 'fail',
                'message': 'Some error occurred. Please try again.'
            }

            return make_response(jsonify(response_object)), 403


class RegisterAPI(MethodView):
    """
    User Registration Resource
    """

    @show_all
    def post(self):
        # get the post data
        post_data = request.get_json()

        email = post_data.get('email', '') or post_data.get('username', '')
        email = email.lower() if email else ''
        password = post_data.get('password')
        phone = post_data.get('phone')
        referral_code = post_data.get('referral_code')

        if phone is not None:
            # this is a registration from a mobile device THUS a vendor or recipient.
            response_object, response_code = UserUtils.proccess_create_or_modify_user_request(
                post_data,
                is_self_sign_up=True,
            )

            if response_code == 200:
                db.session.commit()

            return make_response(jsonify(attach_host(response_object))), response_code

        email_ok = False

        whitelisted_emails = EmailWhitelist.query\
            .filter_by(referral_code=referral_code, used=False) \
            .execution_options(show_all=True).all()

        selected_whitelist_item = None
        exact_match = False

        tier = None
        stengoadmin_emails = current_app.config['stengoADMIN_EMAILS']

        if stengoadmin_emails != [''] and email in stengoadmin_emails:
            email_ok = True
            tier = 'stengoadmin'

        for whitelisted in whitelisted_emails:
            if whitelisted.allow_partial_match and whitelisted.email in email:
                email_ok = True
                tier = whitelisted.tier
                selected_whitelist_item = whitelisted
                exact_match = False
                continue
            elif whitelisted.email == email:
                email_ok = True

                whitelisted.used = True
                tier = whitelisted.tier
                selected_whitelist_item = whitelisted
                exact_match = True
                continue

        if not email_ok:
            response_object = {
                'status': 'fail',
                'message': 'Invalid email domain.',
            }
            return make_response(jsonify(response_object)), 403

        if len(password) < 7:
            response_object = {
                'status': 'fail',
                'message': 'Password must be at least 6 characters long',
            }
            return make_response(jsonify(response_object)), 403

        # check if user already exists
        user = User.query.filter(func.lower(User.email)==email).execution_options(show_all=True).first()
        if user:
            response_object = {
                'status': 'fail',
                'message': 'User already exists. Please Log in.',
            }
            return make_response(jsonify(response_object)), 403

        if tier is None:
            tier = 'subadmin'

        if selected_whitelist_item:
            organisation = selected_whitelist_item.organisation
        else:
            organisation = Organisation.master_organisation()

        user = User(blockchain_address=organisation.primary_blockchain_address)

        user.create_admin_auth(email, password, tier, organisation)

        # insert the user
        db.session.add(user)

        db.session.flush()

        if exact_match:
            user.is_activated = True

            auth_token = user.encode_auth_token()

            # Possible Outcomes:
            # TFA required, but not set up
            # TFA not required

            tfa_response_oject = tfa_logic(user, tfa_token=None)
            if tfa_response_oject:
                tfa_response_oject['auth_token'] = auth_token.decode()

                db.session.commit()  # need this here to commit a created user to the db

                return make_response(jsonify(tfa_response_oject)), 401

            # Update the last_seen TS for this user
            user.update_last_seen_ts()

            response_object = create_user_response_object(user, auth_token, 'Successfully activated.')

            db.session.commit()

            return make_response(jsonify(attach_host(response_object))), 201

        activation_token = user.encode_single_use_JWS('A')

        send_activation_email(activation_token, email)

        db.session.commit()

        # generate the auth token
        response_object = {
            'status': 'success',
            'message': 'Successfully registered. You must activate your email.',
        }

        return make_response(jsonify(attach_host(response_object))), 201


class ActivateUserAPI(MethodView):
    """
    User Registration Resource
    """

    def post(self):
        # get the post data
        post_data = request.get_json()

        activation_token = post_data.get('activation_token')

        if activation_token and activation_token != 'null':
            auth_token = activation_token.split(" ")[0]
        else:
            auth_token = ''
        if auth_token:

            validity_check = User.decode_single_use_JWS(activation_token, 'A')

            if not validity_check['success']:
                response_object = {
                    'status': 'fail',
                    'message': validity_check['message']
                }

                return make_response(jsonify(response_object)), 401

            user = validity_check['user']

            if user.is_activated:
                response_object = {
                    'status': 'fail',
                    'message': 'Already activated.'
                }

                return make_response(jsonify(response_object)), 401

            user.is_activated = True

            auth_token = user.encode_auth_token()

            db.session.flush()

            # Possible Outcomes:
            # TFA required, but not set up
            # TFA not required

            tfa_response_oject = tfa_logic(user, tfa_token=None)
            if tfa_response_oject:
                tfa_response_oject['auth_token'] = auth_token.decode()

                db.session.commit()  # need to commit here so that is_activated = True

                return make_response(jsonify(tfa_response_oject)), 401

            # Update the last_seen TS for this user
            user.update_last_seen_ts()

            response_object = create_user_response_object(user, auth_token, 'Successfully activated.')

            db.session.commit()

            return make_response(jsonify(attach_host(response_object))), 201

        else:
            response_object = {
                'status': 'fail',
                'message': 'Provide a valid auth token.'
            }
            return make_response(jsonify(response_object)), 401