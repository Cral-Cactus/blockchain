import React from "react";
import { connect } from "react-redux";
import { Input, Card, Button, Space, Descriptions, Tag, Select } from "antd";
import {
  ShopOutlined,
  UserOutlined,
  UsergroupAddOutlined,
  UserSwitchOutlined,
} from "@ant-design/icons";

import NewTransferManager from "../management/newTransferManager.jsx";
import HistoryDrawer from "../history/historyDrawer.tsx";
import DateTime from "../dateTime.tsx";

import {
  EditTransferAccountAction,
  LoadTransferAccountHistoryAction,
} from "../../reducers/transferAccount/actions";
import { formatMoney } from "../../utils";
import { TransferAccountTypes } from "./types";

const { TextArea } = Input;
const { Option } = Select;

const mapStateToProps = (state, ownProps) => {
  return {
    adminTier: state.login.adminTier,
    login: state.login,
    creditTransfers: state.creditTransfers,
    transferAccounts: state.transferAccounts,
    transferAccountHistory: state.transferAccounts.loadHistory.changes,
    users: state.users,
    tokens: state.tokens,
    transferAccount:
      state.transferAccounts.byId[parseInt(ownProps.transfer_account_id)],
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    editTransferAccountRequest: (body, path) =>
      dispatch(
        EditTransferAccountAction.editTransferAccountRequest({ body, path })
      ),
    loadTransferAccountHistoryAction: (path) =>
      dispatch(
        LoadTransferAccountHistoryAction.loadTransferAccountHistoryRequest({
          path,
        })
      ),
  };
};

class TransferAccountManager extends React.Component {
  constructor() {
    super();
    this.state = {
      action: "select",
      transfer_type: "ALL",
      create_transfer_type: "RECLAMATION",
      newTransfer: false,
      viewHistory: false,
      transfer_amount: "",
      showSpreadsheetData: true,
      balance: "",
      last_known_card_balance: null,
      is_approved: "n/a",
      one_time_code: "",
      focused: false,
      payable_epoch: null,
      payable_period_type: "n/a",
      payable_period_length: 1,
      is_vendor: null,
    };
    this.handleStatus = this.handleStatus.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.editTransferAccount = this.editTransferAccount.bind(this);
    this.onNewTransfer = this.onNewTransfer.bind(this);
    this.onViewHistory = this.onViewHistory.bind(this);
  }

  componentDidMount() {
    const transferAccountId = parseInt(this.props.transfer_account_id);
    const transferAccount = this.props.transferAccounts.byId[transferAccountId];
    const primaryUser =
      transferAccount.primary_user_id &&
      this.props.users.byId[transferAccount.primary_user_id];

    if (transferAccount) {
      this.setState({
        balance: transferAccount.balance,
        last_known_card_balance: transferAccount.last_known_card_balance,
        is_approved: transferAccount.is_approved,
        notes: transferAccount.notes,
        created: transferAccount.created,
        payable_epoch: transferAccount.payable_epoch,
        payable_period_type: transferAccount.payable_period_type,
        payable_period_length: transferAccount.payable_period_length,
        is_vendor: transferAccount.is_vendor,
        is_beneficiary: transferAccount.is_beneficiary,
        is_tokenagent: transferAccount.is_tokenagent,
        is_groupaccount: transferAccount.is_groupaccount,
      });
    }

    if (primaryUser) {
      this.setState({
        is_vendor: primaryUser.is_vendor,
        is_beneficiary: primaryUser.is_beneficiary,
        is_tokenagent: primaryUser.is_tokenagent,
        is_groupaccount: primaryUser.is_groupaccount,
      });
    }
  }

  componentDidUpdate(newProps) {
    if (
      this.props.creditTransfers !== newProps.creditTransfers &&
      !this.props.creditTransfers.createStatus.isRequesting
    ) {
      this.setState({ newTransfer: false });
    }
  }

  editTransferAccount() {
    const balance = this.state.balance * 100;
    const approve =
      this.state.is_approved === "n/a"
        ? null
        : typeof this.state.is_approved === "boolean"
        ? this.state.is_approved
        : this.state.is_approved === "true";
    const notes = this.state.notes;
    const nfc_card_id = this.state.nfc_card_id;
    const qr_code = this.state.qr_code;
    const phone = this.state.phone;

    if (this.state.payable_epoch) {
      var payable_epoch = this.state.payable_epoch._d;
    }

    const payable_period_length = this.state.payable_period_length;
    const payable_period_type =
      this.state.payable_period_type === "n/a"
        ? null
        : this.state.payable_period_type;

    const single_transfer_account_id =
      this.props.transfer_account_id.toString();
    window.confirm("Are you sure you wish to save changes?") &&
      this.props.editTransferAccountRequest(
        {
          balance,
          approve,
          notes,
          phone,
          nfc_card_id,
          qr_code,
          payable_epoch,
          payable_period_length,
          payable_period_type,
        },
        single_transfer_account_id
      );
  }

  handleChange(evt) {
    this.setState({ [evt.target.name]: evt.target.value });
  }

  handleStatus(status) {
    this.setState({ is_approved: status });
  }

  onViewHistory() {
    this.setState((prevState) => ({
      viewHistory: !prevState.viewHistory,
    }));
    if (!this.state.viewHistory) {
      this.props.loadTransferAccountHistoryAction(
        this.props.transfer_account_id
      );
    }
  }

  onNewTransfer() {
    this.setState((prevState) => ({
      newTransfer: !prevState.newTransfer,
    }));
  }

  render() {
    const { is_beneficiary, is_vendor, is_groupaccount, is_tokenagent } =
      this.state;
    let accountTypeName;
    let icon;
    let color;

    if (this.state.newTransfer) {
      var newTransfer = (
        <NewTransferManager
          transfer_account_ids={[this.props.transfer_account_id]}
          cancelNewTransfer={() => this.onNewTransfer()}
        />
      );
    } else {
      newTransfer = null;
    }

    const currency =
      this.props.transferAccount &&
      this.props.transferAccount.token &&
      this.props.tokens.byId[this.props.transferAccount.token] &&
      this.props.tokens.byId[this.props.transferAccount.token].symbol;
    const balanceDisplayAmount = (
      <p style={{ margin: 0, fontWeight: 100, fontSize: "16px" }}>
        {formatMoney(
          this.state.balance / 100,
          undefined,
          undefined,
          undefined,
          currency
        )}
      </p>
    );
    const cardBalanceDisplayAmount = (
      <p style={{ margin: 0, fontWeight: 100, fontSize: "16px" }}>
        {formatMoney(
          this.state.last_known_card_balance / 100,
          undefined,
          undefined,
          undefined,
          currency
        )}
      </p>
    );