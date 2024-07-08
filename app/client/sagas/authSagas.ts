import {
    call,
    put,
    all,
    cancelled,
    takeEvery,
    select,
  } from "redux-saga/effects";
  import { normalize } from "normalizr";
  import { message } from "antd";
  
  import {
    handleError,
    removeSessionToken,
    storeSessionToken,
    storeTFAToken,
    storeOrgIds,
    removeOrgIds,
    removeTFAToken,
    parseQuery,
    getOrgIds,
  } from "../utils";
  import {
    adminUserSchema,
    inviteUserSchema,
    organisationSchema,
  } from "../schemas";
  
  import {
    requestApiToken,
    refreshApiToken,
    registerAPI,
    activateAPI,
    requestResetEmailAPI,
    ResetPasswordAPI,
    logoutAPI,
    getUserList,
    updateUserAPI,
    inviteUserAPI,
    deleteInviteAPI,
    adminResetPasswordAPI,
    ValidateTFAAPI,
  } from "../api/authAPI";
  
  import { authenticatePusher } from "../api/pusherAPI";
  
  import {
    LoginActionTypes,
    RegisterActionTypes,
    ResetPasswordEmailActionTypes,
    ResetPasswordActionTypes,
    ActivateActionTypes,
    LoadAdminUserListActionTypes,
    EditAdminUserActionTypes,
    DeleteInviteActionTypes,
    InviteUserActionTypes,
    ValidateTfaActionTypes,
    UpdateActiveOrgPayload,
    LoginRequestPayload,
    RegisterRequestPayload,
    ActivatePayload,
    ResetEmailPayload,
    ResetPasswordPayload,
    UpdateUserPayload,
    DeleteInvitePayload,
    InviteUserPayload,
    ValidateTfaPayload,
    TokenData,
    OrganisationLoginData,
    AdminData,
    InviteByIDs,
    AdminResetPasswordActionTypes,
    AdminResetPasswordPayload,
  } from "../reducers/auth/types";
  
  import {
    AdminUserListAction,
    InviteUserListAction,
    LoginAction,
    RegisterAction,
    ActivateAccountAction,
    ResetPasswordEmailAction,
    ResetPasswordAction,
    LoadAdminUserListAction,
    EditAdminUserAction,
    DeleteInviteAction,
    InviteUserAction,
    ValidateTfaAction,
    AdminResetPasswordAction,
  } from "../reducers/auth/actions";
  
  import { browserHistory } from "../createStore";
  import { OrganisationAction } from "../reducers/organisation/actions";
  import { ActionWithPayload } from "../reduxUtils";
  import { ReduxState } from "../reducers/rootReducer";
  import { TokenListAction } from "../reducers/token/actions";
  
  function* updateStateFromAdmin(data: AdminData) {
    //Schema expects a list of admin user objects
    let admin_list;
    let invite_list;
  
    if (data.admins) {
      admin_list = data.admins;
    } else {
      admin_list = [data.admin];
    }
  
    if (data.invites) {
      invite_list = data.invites;
    } else {
      invite_list = [data.invite];
    }
  
    const normalizeAdminData = normalize(admin_list, adminUserSchema);
    const normalizeInviteData = normalize(invite_list, inviteUserSchema);
  
    const admins = normalizeAdminData.entities.admins;
    const invites = normalizeInviteData.entities.invites;
  
    yield put(AdminUserListAction.updateAdminUserList(admins));
    yield put(InviteUserListAction.deepUpdateInviteUsers(invites || []));
  }
  
  export function* updateOrganisationStateFromLoginData(
    data: OrganisationLoginData
  ) {
    //Schema expects a list of organisation objects
    let organisation_list;
    if (data.organisations) {
      organisation_list = data.organisations;
    } else {
      organisation_list = [data.organisation];
    }
  
    const normalizedData = normalize(organisation_list, organisationSchema);
  
    const tokens = normalizedData.entities.tokens;
    if (tokens) {
      yield put(TokenListAction.updateTokenList(tokens));
    }
  
    const organisations = normalizedData.entities.organisations;
    if (organisations) {
      yield put(OrganisationAction.updateOrganisationList(organisations));
    }
  }
  
  function* saveOrgId(
    action: ActionWithPayload<
      LoginActionTypes.UPDATE_ACTIVE_ORG,
      UpdateActiveOrgPayload
    >
  ) {
    try {
      const isManageWallet = action.payload.isManageWallet;
      yield call(storeOrgIds, action.payload.organisationIds);
  
      // window.location.search = "?org=2" or "?query_organisations=1,2"
      // query_params = {org: "2"} or {query_organisations: "1,2"}
      let query_params: any = parseQuery(window.location.search);
  
      // if query param and payload are matching then just reload to update navbar
      if (
        query_params["org"] &&
        action.payload.organisationIds[0] === parseInt(query_params["org"])
      ) {
        window.location.reload();
      } else if (
        query_params["query_organisations"] &&
        action.payload.organisationIds.toString() ===
          query_params["query_organisations"]
      ) {
        isManageWallet
          ? window.location.assign("/manage")
          : window.location.reload();
      } else {
        isManageWallet
          ? window.location.assign("/manage")
          : window.location.assign("/");
      }
    } catch (e) {
      removeOrgIds();
    }
  }
  
  function* watchSaveOrgId() {
    yield takeEvery(LoginActionTypes.UPDATE_ACTIVE_ORG, saveOrgId);
  }
  
  export function* apiLogout() {
    yield call(logoutAPI);
    yield call(removeSessionToken);
    yield call(removeOrgIds);
  }
  
  export function* logout() {
    yield call(removeSessionToken);
    yield call(removeOrgIds);
  }
  
  function createLoginSuccessObject(token: TokenData) {
    return {
      token: token.auth_token,
      userId: token.user_id,
      email: token.email,
      adminTier: token.admin_tier,
      usdToSatoshiRate: token.usd_to_satoshi_rate,
      intercomHash: token.web_intercom_hash,
      webApiVersion: token.web_api_version,
      organisationId: token.active_organisation_id,
      organisationIds: token.organisation_ids,
    };
  }
  
  function* requestToken(
    action: ActionWithPayload<LoginActionTypes.LOGIN_REQUEST, LoginRequestPayload>
  ) {
    try {
      const token_response = yield call(requestApiToken, action.payload);
  
      if (token_response.status === "success") {
        yield call(updateOrganisationStateFromLoginData, token_response);
  
        storeSessionToken(token_response.auth_token);
        yield call(authenticatePusher);
  
        yield put(
          LoginAction.loginSuccess(createLoginSuccessObject(token_response))
        );
  
        return token_response;
      } else if (token_response.tfa_url) {
        storeSessionToken(token_response.auth_token);
        yield put(
          LoginAction.loginPartial({
            error: token_response.message,
            tfaURL: token_response.tfa_url,
            tfaFailure: true,
          })
        );
  
        return token_response;
      } else if (token_response.tfa_failure) {
        yield call(removeTFAToken); // something failed on the TFA logic
        storeSessionToken(token_response.auth_token);
        yield put(
          LoginAction.loginPartial({
            error: token_response.message,
            tfaURL: null,
            tfaFailure: true,
          })
        );
        return token_response;
      } else {
        yield put(LoginAction.loginFailure(token_response.message));
        message.error(token_response.message);
      }
    } catch (error) {
      yield put(LoginAction.loginFailure(error.statusText));
      message.error(error.statusText);
    } finally {
      if (yield cancelled()) {
        // ... put special cancellation handling code here
      }
    }
  }
  
  function* watchLoginRequest() {
    yield call(refreshToken);
    yield takeEvery(LoginActionTypes.LOGIN_REQUEST, requestToken);
  }
  
  function* refreshToken() {
    try {
      yield put(LoginAction.reauthRequest());
      const token_request = yield call(refreshApiToken);
      if (token_request.auth_token) {
        storeSessionToken(token_request.auth_token);
  
        let orgId = getOrgIds();
        let orgIds = orgId && orgId.split(",");
        if (orgIds && orgIds.length > 1) {
          token_request["organisation_ids"] = orgIds;
        } else {
          token_request["organisation_ids"] = null;
        }
  
        yield call(updateOrganisationStateFromLoginData, token_request);
        yield put(
          LoginAction.loginSuccess(createLoginSuccessObject(token_request))
        );
        yield call(authenticatePusher);
      }
      return token_request;
    } catch (error) {
      yield put(LoginAction.logout());
      return error;
    } finally {
      if (yield cancelled()) {
        // ... put special cancellation handling code here
      }
    }
  }
  
  function* watchAPILogoutRequest() {
    yield takeEvery([LoginActionTypes.API_LOGOUT], apiLogout);
  }
  
  function* watchLogoutRequest() {
    yield takeEvery(
      [LoginActionTypes.LOGOUT, LoginActionTypes.LOGIN_FAILURE],
      logout
    );
  }