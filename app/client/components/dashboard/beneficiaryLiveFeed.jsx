import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { Card } from "antd";
import { ArrowsAltOutlined, ShrinkOutlined } from "@ant-design/icons";

import { formatMoney } from "../../utils.js";

import DateTime from "../dateTime.tsx";
import LoadingSpinner from "../loadingSpinner.jsx";

const mapStateToProps = state => {
  return {
    creditTransferList: Object.keys(state.creditTransfers.byId)
      .filter(id => typeof state.creditTransfers.byId[id] !== "undefined")
      .map(id => state.creditTransfers.byId[id]),
    users: state.users,
    transferAccounts: state.transferAccounts,
    creditTransfers: state.creditTransfers,
    login: state.login,
    tokens: state.tokens
  };
};

class BeneficiaryLiveFeed extends React.Component {
  navigateToAccount = accountId => {
    window.location.assign("/accounts/" + accountId);
  };

  render() {
    const {
      expanded,
      users,
      transferAccounts,
      creditTransfers,
      creditTransferList,
      tokens
    } = this.props;

    const collapsedCardStyle = {
      width: "100%"
    };

    const collapsedBodyStyle = {
      height: "140px",
      overflowY: "scroll"
    };

    const collapsedLiveFeedStyle = {};

    const expandedCardStyle = {
      height: "100vh",
      position: "fixed",
      background: "#f0f2f5"
    };

    const expandedBodyStyle = {
      height: "100%"
    };

    const expandedLiveFeedStyle = {
      height: "100%",
      overflowY: "scroll",
      borderColor: "#4a4a4a",
      borderTop: "1px solid",
      borderTopWidth: "1px",
      borderTopStyle: "solid",
      paddingBottom: "60px"
    };

    if (Object.keys(creditTransferList).length == 0) {
      return <LoadingSpinner />;
    } else {
      return (
        <Card
          title="Live Feed"
          bordered={false}
          style={expanded ? expandedCardStyle : collapsedCardStyle}
          bodyStyle={expanded ? expandedBodyStyle : collapsedBodyStyle}
          extra={
            expanded ? (
              <ShrinkOutlined onClick={this.props.handleExpandToggle} />
            ) : (
              <ArrowsAltOutlined onClick={this.props.handleExpandToggle} />
            )
          }
        >
          <LiveFeed
            style={expanded ? expandedLiveFeedStyle : collapsedLiveFeedStyle}
          >
            {creditTransferList
              .sort((a, b) => b.id - a.id)
              .map(transfer => {
                let recipient_transfer_account =
                  transferAccounts.byId[transfer.recipient_transfer_account_id];
                let recipient_blockchain_address =
                  (recipient_transfer_account &&
                    recipient_transfer_account.blockchain_address) ||
                  "";
                let sender_transfer_account =
                  transferAccounts.byId[transfer.sender_transfer_account_id];
                let sender_blockchain_address =
                  (sender_transfer_account &&
                    sender_transfer_account.blockchain_address) ||
                  "";
                let isRecipientVendor =
                  recipient_transfer_account &&
                  recipient_transfer_account.is_vendor;
                let isSenderVendor =
                  sender_transfer_account && sender_transfer_account.is_vendor;

                if (
                  transfer.recipient_user !== null &&
                  typeof transfer.recipient_user !== "undefined"
                ) {
                  var recipient_user = users.byId[transfer.recipient_user];
                  if (typeof recipient_user !== "undefined") {
                    let fName = recipient_user.first_name;
                    let lName = recipient_user.last_name;
                    var recipient_user_name =
                      (fName === null ? "" : fName) +
                      " " +
                      (lName === null ? "" : lName);
                  }
                } else if (
                  typeof recipient_blockchain_address !== "undefined"
                ) {
                  recipient_user_name =
                    (isRecipientVendor
                      ? "Vendor "
                      : window.BENEFICIARY_TERM + " ") +
                    "Address " +
                    recipient_blockchain_address.slice(0, 8) +
                    "...";
                } else {
                  recipient_user_name = null;
                }

                if (
                  transfer.sender_user !== null &&
                  typeof transfer.sender_user !== "undefined"
                ) {
                  var sender_user = users.byId[transfer.sender_user];
                  if (typeof sender_user !== "undefined") {
                    let fName = sender_user.first_name;
                    let lName = sender_user.last_name;
                    var sender_user_name =
                      (fName === null ? "" : fName) +
                      " " +
                      (lName === null ? "" : lName);
                  }
                } else if (typeof sender_blockchain_address !== "undefined") {
                  sender_user_name =
                    (isSenderVendor
                      ? "Vendor "
                      : window.BENEFICIARY_TERM + " ") +
                    "Address " +
                    sender_blockchain_address.slice(0, 8) +
                    "...";
                } else {
                  sender_user_name = null;
                }

                let currency;
                let exchangeToTransfer;
                let transferToMoney;
                let recipientCurrency;
                let showExchange = false;

                const transferAccountId = transfer.sender_transfer_account_id;
                currency =
                  transfer.token &&
                  tokens.byId[transfer.token] &&
                  tokens.byId[transfer.token].symbol;
                const transferFromMoney = formatMoney(
                  transfer.transfer_amount / 100,
                  undefined,
                  undefined,
                  undefined,
                  currency
                );