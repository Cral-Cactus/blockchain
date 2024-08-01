import React from "react";
import { connect } from "react-redux";
import { ThemeProvider } from "styled-components";
import { Card } from "antd";

import { PageWrapper, WrapperDiv } from "../styledElements.js";
import { LightTheme } from "../theme.js";

import StandardTransferAccountList from "../creditTransfer/StandardCreditTransferList";

import organizationWrapper from "../organizationWrapper.jsx";
import NoDataMessage from "../NoDataMessage";

const mapStateToProps = state => {
  return {
    login: state.login,
    transferAccounts: state.transferAccounts,
    mergedTransferAccountUserList: Object.keys(state.transferAccounts.byId)
      .map(id => {
        return {
          ...{
            id,
            ...state.users.byId[state.transferAccounts.byId[id].primary_user_id]
          },
          ...state.transferAccounts.byId[id]
        };
      })
      .filter(mergedObj => mergedObj.users && mergedObj.users.length >= 1),
    users: state.users
  };
};

class TransferAccountListPage extends React.Component {
  componentDidMount() {
    this.buildFilterForAPI();
  }

  componentDidUpdate(newProps) {
    if (newProps.location.pathname !== location.pathname) {
      this.buildFilterForAPI();
    }
  }

  buildFilterForAPI() {
    let query = {};

    if (this.props.transferAccounts.loadStatus.lastQueried) {
      query.updated_after = this.props.transferAccounts.loadStatus.lastQueried;
    }
  }

  render() {
    let transferAccountList = this.props.mergedTransferAccountUserList;

    if (this.props.login.adminTier === "view") {
      transferAccountList = Object.keys(this.props.transferAccounts.byId).map(
        id => this.props.transferAccounts.byId[id]
      );
    }