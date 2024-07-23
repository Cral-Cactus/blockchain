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


        class LoginAPI(MethodView):
        """
        User Login Resource
        """

     def get(self):

        print("process started")

        challenges = [
            ('Why don’t they play poker in the jungle?', 'Too many cheetahs.'),
            ('What did the Buddhist say to the hot dog vendor?', 'Make me one with everything.'),
            ('What does a zombie vegetarian eat?', 'Graaaaaaaains!'),
            ('My new thesaurus is terrible.', 'Not only that, but it’s also terrible.'),
            ('Why didn’t the astronaut come home to his wife?', 'He needed his space.'),
            ('I got fired from my job at the bank today.',
             'An old lady came in and asked me to check her balance, so I pushed her over.'),
            ('I like to spend every day as if it’s my last',
             'Staying in bed and calling for a nurse to bring me more pudding.')
        ]

        challenge = random.choice(challenges)

        # time.sleep(int(request.args.get('delay', 0)))
        # from functools import reduce
        # reduce(lambda x, y: x + y, range(0, int(request.args.get('count', 1))))

        # memory_to_consume = int(request.args.get('MB', 0)) * 1000000
        # bytearray(memory_to_consume)

        ip_address = request.environ.get('HTTP_X_REAL_IP', request.remote_addr)
        user_agent = request.environ["HTTP_USER_AGENT"]
        ip = request.environ["REMOTE_ADDR"]
        # proxies = request.headers.getlist("X-Forwarded-For")
        # http://esd.io/blog/flask-apps-heroku-real-ip-spoofing.html

        response_object = {
            'status': 'success',
            'who_allows_a_get_request_to_their_auth_endpoint': 'We do.',
            challenge[0]: challenge[1],
            # 'metadata': {'user_agent': user_agent, 'ip': ip_address, 'otherip': ip, 'proxies': proxies},
        }
        return make_response(jsonify(attach_host(response_object))), 200

    def post(self):
        # There is an unique case where users are using their mobile number from the App to either login or register
        # The app uses g.active_organisation to reference user.transfer_account to send an SMS to the User.
        # This means that g.active_organisation should default to the master_organisation
        # For admin users, it doesn't matter as this endpoint is unauthed.
        g.active_organisation = Organisation.master_organisation()

        post_data = request.get_json()
        user = None
        phone = None
        email = post_data.get('username', '') or post_data.get('email', '')
        email = email.lower() if email else ''
        password = post_data.get('password')
        # Default pin to password as fallback for old android versions
        pin = post_data.get('pin', password)
        tfa_token = post_data.get('tfa_token')

        password_empty = password == '' or password is None
        pin_empty = pin == '' or pin is None

        ratelimit_key = email or post_data.get('phone')
        if ratelimit_key:
            limit = rate_limit("login_"+ratelimit_key, 25)
            if limit:
                response_object = {
                    'status': 'fail',
                    'message': f'Please try again in {limit} minutes'
                }
                return make_response(jsonify(response_object)), 403

        # First try to match email
        if email:
            user = User.query.filter(func.lower(User.email)==email).execution_options(show_all=True).first()

        # Now try to match the public serial number (comes in under the phone)
        if not user:
            public_serial_number_or_phone = post_data.get('phone')

            user = User.query.filter_by(public_serial_number=public_serial_number_or_phone).execution_options(
                show_all=True).first()

        # Now try to match the phone
        if not user:
            try:
                phone = proccess_phone_number(post_data.get('phone'), region=post_data.get('region'))
            except NumberParseException as e:
                response_object = {'message': 'Invalid Phone Number: ' + str(e)}
                return make_response(jsonify(response_object)), 401

            if phone:
                user = User.query.filter_by(phone=phone).execution_options(show_all=True).first()

        # mobile user doesn't exist so default to creating a new wallet!
        if user is None and phone and current_app.config['ALLOW_SELF_SIGN_UP']:
            # this is a registration from a mobile device THUS a vendor or recipient.
            response_object, response_code = UserUtils.proccess_create_or_modify_user_request(
                dict(phone=phone, deviceInfo=post_data.get('deviceInfo')),
                is_self_sign_up=True,
            )

            if response_code == 200:
                db.session.commit()

            return make_response(jsonify(response_object)), response_code
        no_password_or_pin_hash = user and not user.password_hash and not user.pin_hash
        if post_data.get('phone') and user and user.one_time_code and (not user.is_activated or not user.pin_hash):
            # vendor sign up with one time code or OTP verified
            if user.one_time_code == pin:
                response_object = {
                    'status': 'success',
                    'pin_must_be_set': True,
                    'message': 'Please set your pin.'
                }
                return make_response(jsonify(attach_host(response_object))), 200

            if not user.is_phone_verified or no_password_or_pin_hash:
                if user.is_self_sign_up:
                    # self sign up, resend phone verification code
                    user.set_pin(None, False)  # resets PIN
                    UserUtils.send_one_time_code(phone=phone, user=user)
                db.session.commit()

                if not password_empty:
                    # The user provided a password, so probably not going through incremental login
                    # This is a hacky way to get past the incremental-login multi-org split
                    response_object = {
                        'status': 'fail',
                        'otp_verify': True,
                        'message': 'Please verify phone number.',
                        'error_message': 'Incorrect One Time Code.'
                    }
                    return make_response(jsonify(attach_host(response_object))), 200

                response_object = {'message':  'Please verify phone number.', 'otp_verify': True}
                return make_response(jsonify(attach_host(response_object))), 200

        if user and user.is_activated and post_data.get('phone') and (password_empty and pin_empty):
            # user already exists, is activated. no password or pin provided, thus request PIN screen.
            # todo: this should check if device exists, if no, resend OTP to verify login is real.
            response_object = {
                'status': 'success',
                'login_with_pin': True,
                'message': 'Login with PIN'
            }
            return make_response(jsonify(attach_host(response_object))), 200

        if not (email or post_data.get('phone')):
            response_object = {
                'status': 'fail',
                'message': 'No username supplied'
            }
            return make_response(jsonify(response_object)), 401
    

        try:
            if not (user and (pin and user.verify_pin(pin) or password and user.verify_password(password))):
                response_object = {
                    'status': 'fail',
                    'message': 'Invalid username or password'
                }

                return make_response(jsonify(response_object)), 401

            if not user.is_activated:
                response_object = {
                    'status': 'fail',
                    'is_activated': False,
                    'message': 'Account has not been activated. Please check your emails.'
                }
                return make_response(jsonify(response_object)), 401
            if post_data.get('deviceInfo'):
                deviceInfo = post_data.get('deviceInfo')
                UserUtils.save_device_info(deviceInfo, user)

            auth_token = user.encode_auth_token()

            if not auth_token:
                response_object = {
                    'status': 'fail',
                    'message': 'Invalid username or password'
                }
                return make_response(jsonify(response_object)), 401

            # Possible Outcomes:
            # TFA required, but not set up
            # TFA enabled, and user does not have valid TFA token
            # TFA enabled, and user has valid TFA token
            # TFA not required

            tfa_response_oject = tfa_logic(user, tfa_token)
            if tfa_response_oject:
                tfa_response_oject['auth_token'] = auth_token.decode()

                return make_response(jsonify(tfa_response_oject)), 401

            # Update the last_seen TS for this user
            user.update_last_seen_ts()

            response_object = create_user_response_object(user, auth_token, 'Successfully logged in.')

            db.session.commit()

            return make_response(jsonify(attach_host(response_object))), 200

        except Exception as e:
            sentry_sdk.capture_exception(e)
            raise e


class LogoutAPI(MethodView):
    """
    Logout Resource
    """

    def post(self):
        # get auth token
        auth_header = request.headers.get('Authorization')
        if auth_header:
            auth_token = auth_header.split(" ")[0]
        else:
            auth_token = ''
        auth_token = auth_header.split("|")[0]
        if auth_token:
            resp = User.decode_auth_token(auth_token)
            if not isinstance(resp, str):
                # mark the token as blacklisted
                blacklist_token = BlacklistToken(token=auth_token, user_id=resp['id'])
                try:
                    # insert the token
                    db.session.add(blacklist_token)
                    db.session.commit()
                    response_object = {
                        'status': 'success',
                        'message': 'Successfully logged out.'
                    }
                    return make_response(jsonify(attach_host(response_object))), 200
                except Exception as e:
                    response_object = {
                        'status': 'fail',
                        'message': e
                    }
                    return make_response(jsonify(attach_host(response_object))), 200
            else:
                response_object = {
                    'status': 'fail',
                    'message': resp
                }
                return make_response(jsonify(response_object)), 401

        else:
            response_object = {
                'status': 'fail',
                'message': 'Provide a valid auth token.'
            }
            return make_response(jsonify(response_object)), 403


class RequestPasswordResetEmailAPI(MethodView):
    """
    Password Reset Email Resource
    """

    def post(self):
        # get the post data
        post_data = request.get_json()

        email = post_data.get('email', '')
        email = email.lower() if email else ''
        if not email:
            response_object = {
                'status': 'fail',
                'message': 'No email supplied'
            }

            return make_response(jsonify(response_object)), 401

        limit = rate_limit("password_reset_"+email, 25)
        if limit:
            response_object = {
                'status': 'fail',
                'message': f'Please try again in {limit} minutes'
            }
            return make_response(jsonify(response_object)), 403

        user = User.query.filter(func.lower(User.email)==email).execution_options(show_all=True).first()

        if user:
            user.reset_password()

        response_object = {
            'status': 'success',
            'message': 'Reset email sent'
        }

        return make_response(jsonify(attach_host(response_object))), 200
