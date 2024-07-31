import React from "react";
import { connect } from "react-redux";
import { Card } from "antd";

import { CenterLoadingSideBarActive, WrapperDiv } from "../styledElements.js";

import organizationWrapper from "../organizationWrapper.jsx";
import LoadingSpinner from "../loadingSpinner";
import SingleCreditTransfer from "../creditTransfer/singleCreditTransfer";
import { LoadCreditTransferAction } from "../../reducers/creditTransfer/actions";

const mapStateToProps = state => {
  return {
    creditTransfers: state.creditTransfers
  };
};

const mapDispatchToProps = dispatch => {
  return {
    loadCreditTransferList: path =>
      dispatch(
        LoadCreditTransferAction.loadCreditTransferRequest({ path })
      )
  };
};

class SingleCreditTransferPage extends React.Component {
  componentDidMount() {
    let pathname_array = location.pathname.split("/").slice(1);
    let creditTransferId = parseInt(pathname_array[1]);
    this.props.loadCreditTransferList(creditTransferId);
  }