import React from "react";
import { connect } from "react-redux";
import { browserHistory } from "../../createStore.js";
import { Card, Table, Tag, Menu, Button, Dropdown } from "antd";

import {
  LoadAdminUserListAction,
  EditAdminUserAction,
  AdminResetPasswordAction,
  DeleteInviteAction,
} from "../../reducers/auth/actions";
import LoadingSpinner from "../loadingSpinner.jsx";

const mapStateToProps = (state) => {
  return {
    login: state.login,
    loggedIn: state.login.userId != null,
    adminUsers: state.adminUsers,
    //todo: not the cleanest, but need to make IDs unique
    adminUserList: Object.keys(state.adminUsers.adminsById)
      .map((id) => state.adminUsers.adminsById[id])
      .map((i) => {
        if (typeof i.id !== "string") {
          i.id = "u" + i.id;
        }
        return i;
      }),
    inviteUserList: Object.keys(state.adminUsers.invitesById)
      .map((id) => state.adminUsers.invitesById[id])
      .map((i) => {
        if (typeof i.id !== "string") {
          i.id = "i" + i.id;
        }
        return i;
      }),
    updateUserRequest: state.updateUserRequest,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    loadUserList: () =>
      dispatch(LoadAdminUserListAction.loadAdminUserListRequest()),
    updateUser: (body, query) =>
      dispatch(EditAdminUserAction.editAdminUserRequest({ body, query })),
    resetPassword: (path) =>
      dispatch(AdminResetPasswordAction.adminResetPasswordRequest({ path })),
    deleteInvite: (payload) =>
      dispatch(DeleteInviteAction.deleteInviteRequest(payload)),
  };
};

class AdminUserList extends React.Component {
  constructor() {
    super();
    this.state = {
      data: [],
      pages: null,
      loading: true,
      action: false,
      user_id: null,
    };
  }

  componentDidMount() {
    this.props.loadUserList();
  }

  updateUserAccountPermissions(user_id, query, deactivated) {
    let userId = user_id.substring(1); // convert 'u1' to 1

    if (query === "resend") {
      this.props.updateUser(
        {
          invite_id: userId,
          resend: true,
        },
        {}
      );
    } else if (query === "reset_pw") {
      this.props.resetPassword(userId);
    } else if (query === "delete") {
      this.props.deleteInvite({ body: { invite_id: parseInt(userId) } });
    } else {
      this.props.updateUser(
        {
          user_id: userId,
          admin_tier: query,
          deactivated: deactivated,
        },
        {}
      );
    }
  }

  displayCorrectStatus(item) {
    let statusComponent;
    if (typeof item.is_disabled === "undefined") {
      // email invite
      statusComponent = (
        <Tag color={"rgba(39, 164, 167, 0.8)"} key={"Invited"}>
          Invited
        </Tag>
      );
    } else if (item.is_disabled) {
      statusComponent = (
        <Tag color={"rgba(255, 0, 0, 0.8)"} key={"Disabled"}>
          Disabled
        </Tag>
      );
    } else if (!item.is_activated) {
      statusComponent = (
        <Tag color={"rgba(39, 164, 167, 0.8)"} key={"Unactivated"}>
          Unactivated
        </Tag>
      );
    }
    return statusComponent;
  }