from flask import g, make_response, jsonify
from flask.views import MethodView

from server.schemas import user_schema
from server.utils.auth import requires_auth, show_all


class MeAPI(MethodView):
    @requires_auth
    @show_all
    def get(self):

        user = g.user

        serialised_data = user_schema.dump(user).data

        response_object = {
            'message': 'Successfully Loaded.',
            'data': {
                'user': serialised_data
            }
        }

        return make_response(jsonify(response_object)), 201