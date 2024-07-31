import React from "react";
import moment from "moment";

import { connect } from "react-redux";
import { Card, Button, Space, Tag, Alert, Input } from "antd";

import { PageWrapper, WrapperDiv } from "../styledElements";

import organizationWrapper from "../organizationWrapper.jsx";
import { apiActions } from "../../genericState";
import { stengoObjects } from "../../reducers/rootReducer";
import { formatMoney, getActiveToken, toCurrency } from "../../utils";
import { DisconnectedCreditTransferList } from "../creditTransfer/CreditTransferList";
import { DisconnectedTransferAccountList } from "../transferAccount/TransferAccountList";
import AsyncModal from "../AsyncModal";
const { TextArea } = Input;

const mapStateToProps = (state) => ({
  bulkTransfers: state.bulkTransfers,
  activeToken: getActiveToken(state),
  transferAccounts: state.transferAccounts,
});

const mapDispatchToProps = (dispatch) => {
  return {
    loadBulkDisbursement: (path, page, per_page) =>
      dispatch(
        apiActions.load(stengoObjects.bulkTransfers, path, {
          per_page: per_page,
          page: page,
        })
      ),
    modifyBulkDisbursement: (path, body) =>
      dispatch(apiActions.modify(stengoObjects.bulkTransfers, path, body)),
  };
};

class SingleBulkDisbursementPage extends React.Component {
  navigateToUser = (accountId) => {
    window.location.assign("/users/" + accountId);
  };

  constructor(props) {
    super(props);
    this.state = {
      page: 1,
      per_page: 10,
      isCompleting: false,
    };
  }

  onPaginateChange = (page, pageSize) => {
    let per_page = pageSize || 10;
    this.setState({
      page,
      per_page,
    });
    this.props.loadBulkDisbursement(
      this.props.match.params.bulkId,
      page,
      per_page
    );
  };

  componentDidMount() {
    let bulkId = this.props.match.params.bulkId;
    this.props.loadBulkDisbursement(
      bulkId,
      this.state.page,
      this.state.per_page
    );
  }

  onAsyncComplete() {
    let bulkId = this.props.match.params.bulkId;
    this.props.loadBulkDisbursement(
      bulkId,
      this.state.page,
      this.state.per_page
    );
  }

  toggleAsyncHide = (e) => {
    this.setState({ isCompleting: !this.state.isCompleting });
  };

  onComplete() {
    let bulkId = this.props.match.params.bulkId;
    this.props.modifyBulkDisbursement(bulkId, {
      action: "APPROVE",
      notes: this.state.notes,
    });
    this.setState({
      isCompleting: true,
    });
  }

  onReject() {
    let bulkId = this.props.match.params.bulkId;
    this.props.modifyBulkDisbursement(bulkId, {
      action: "REJECT",
      notes: this.state.notes,
    });
  }

  render() {
    let bulkId = this.props.match.params.bulkId;
    let bulkItem = this.props.bulkTransfers.byId[bulkId];
    let bulkTransferRequesting =
      this.props.bulkTransfers.loadStatus.isRequesting;
    let pagination = this.props.bulkTransfers.pagination;
    let asyncId = this.props.bulkTransfers.asyncId;

    let totalAmount;
    if (bulkItem && bulkItem.total_disbursement_amount) {
      totalAmount = formatMoney(
        toCurrency(bulkItem.total_disbursement_amount),
        undefined,
        undefined,
        undefined,
        this.props.activeToken.symbol
      );
    }

    let individualAmount;
    if (bulkItem && bulkItem.disbursement_amount) {
      individualAmount = formatMoney(
        bulkItem.disbursement_amount / 100,
        undefined,
        undefined,
        undefined,
        this.props.activeToken.symbol
      );
    }

    let status = bulkItem && bulkItem.state;
    let completion_status = bulkItem && bulkItem.completion_status;
    let transferType = bulkItem && bulkItem.transfer_type;
    let creatorUser = bulkItem && bulkItem.creator_user;
    let approvalTimes = (bulkItem && bulkItem.approval_times) || [];
    let approvers = (bulkItem && bulkItem.approvers) || [];
    let label = bulkItem && bulkItem.label;
    let notes = bulkItem && bulkItem.notes;
    let items = pagination && pagination.items;
    let creditTransferList = (bulkItem && bulkItem.credit_transfers) || [];
    let transferAccountList = (bulkItem && bulkItem.transfer_accounts) || [];
    let showAsyncModal =
      completion_status === "PENDING" &&
      asyncId &&
      this.state.isCompleting &&
      !bulkTransferRequesting
        ? true
        : false;
    let asyncModal = null;
    if (showAsyncModal) {
      asyncModal = (
        <AsyncModal
          title={"Processing Bulk Disbursement"}
          asyncId={asyncId}
          isModalVisible={showAsyncModal}
          onComplete={(e) => this.onAsyncComplete()}
          toggleAsyncHide={(e) => this.toggleAsyncHide()}
        />
      );
    }
    if (
      bulkItem &&
      bulkItem.disbursement_amount &&
      transferType == "WITHDRAWAL"
    ) {
      totalAmount = individualAmount;
      individualAmount = 0;
    }

    const approversList = approvers.map((approver, index, approversList) => {
      const spacer = index + 1 == approversList.length ? "" : ", ";
      const approvalTime = approvalTimes[index]
        ? " at " +
          moment.utc(approvalTimes[index]).local().format("YYYY-MM-DD HH:mm:ss")
        : "";
      return (
        <div>
          <a
            style={{ cursor: "pointer" }}
            onClick={() => this.navigateToUser(approver && approver.id)}
          >
            {approver && " " + approver.email}
          </a>
          {approvalTime + spacer}
        </div>
      );
    });

    let tag;
    let info;
    if (status === "APPROVED") {
      tag = <Tag color="#9bdf56">Approved</Tag>;
      info = (
        <div style={{ maxWidth: "700px", marginTop: "20px" }}>
          <Alert
            message="If there are many disbursements, it can take a while for all of them to appear in the transfers list."
            type="info"
            showIcon
          />
        </div>
      );
    } else if (status === "PARTIAL") {
      tag = <Tag color="#d48806">Partial</Tag>;
    } else if (status === "PENDING") {
      tag = <Tag color="#e2a963">Pending</Tag>;
    } else {
      tag = <Tag color="#f16853">Rejected</Tag>;
    }

    let completion_tag;
    if (completion_status === "COMPLETE") {
      completion_tag = <Tag color="#9bdf56">Complete</Tag>;
    } else if (completion_status === "PROCESSING") {
      completion_tag = (
        <Tag color="#d48806" onClick={this.toggleAsyncHide}>
          Processing
        </Tag>
      );
    } else if (completion_status === "PENDING") {
      completion_tag = (
        <Tag onClick={this.toggleAsyncHide} color="#e2a963">
          Pending
        </Tag>
      );
    } else {
      completion_tag = <Tag color="#e2a963">Unknown</Tag>;
    }

    var creditTransfersById = {};
    creditTransferList.forEach((transfer) => {
      creditTransfersById[transfer.id] = transfer;
    });
    creditTransferList["byId"] = creditTransfersById;
    creditTransferList["loadStatus"] = { isRequesting: false };

    var transferAccountsById = {};
    transferAccountList.forEach((transfer) => {
      transferAccountsById[transfer.id] = transfer;
    });
    var IdList = [];
    transferAccountList.forEach((transferAccount) => {
      IdList.push(transferAccount.id);
    });
    transferAccountList["byId"] = transferAccountsById;
    transferAccountList["loadStatus"] = { isRequesting: false };
    transferAccountList["IdList"] = IdList;

    var users = [];
    transferAccountList.forEach((transferAccount) => {
      users = users.concat(transferAccount.users);
    });
    var usersByID = {};
    users.forEach((transfer) => {
      usersByID[transfer.id] = transfer;
    });
    users["byId"] = usersByID;
    users["loadStatus"] = { isRequesting: false };