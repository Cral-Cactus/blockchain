import React from "react";
import { connect } from "react-redux";
import styled, { ThemeProvider } from "styled-components";

import { WyreAction } from "../../reducers/wyre/actions";
import LoadingSpinner from "../loadingSpinner.jsx";

const mapStateToProps = state => {
  return {
    wyreAccountStatus: state.wyre.loadWyreAccountStatus,
    wyreAccount: state.wyre.wyreState.wyre_account
  };
};

const mapDispatchToProps = dispatch => {
  return {
    loadWyreAccount: () => dispatch(WyreAction.loadWyreAccountRequest())
  };
};

class WyreWalletBalance extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  componentDidMount() {
    // todo-- fix this
    // this.props.loadWyreAccount()
  }

  render() {
    let { wyreAccountStatus, wyreAccount } = this.props;

    if (wyreAccount !== null && typeof wyreAccount !== undefined) {
      var balance = "$" + wyreAccount.availableBalances["USD"] + " USD";
    } else {
      balance = "You currently have no balance";
    }