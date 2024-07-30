import * as React from "react";
import { connect } from "react-redux";
import { Modal, Button, InputNumber, Space, Select, Input } from "antd";
const { Option } = Select;

import { ReduxState, sempoObjects } from "../../reducers/rootReducer";
import {
  EditTransferAccountPayload,
  LoadTransferAccountListPayload,
} from "../../reducers/transferAccount/types";
import {
  EditTransferAccountAction,
  LoadTransferAccountAction,
} from "../../reducers/transferAccount/actions";

import QueryConstructor, { Query } from "../filterModule/queryConstructor";

import {
  CreateBulkTransferBody,
  TransferTypes,
} from "../../reducers/bulkTransfer/types";
import { getActiveToken } from "../../utils";
import { apiActions, CreateRequestAction } from "../../genericState";

type numberInput = string | number | null | undefined;

interface StateProps {
  adminTier: any;
  activeToken: any;
  transferAccounts: any;
  bulkTransfers: any;
  login: any;
  organisations: any;
}

interface DispatchProps {
  editTransferAccountRequest: (
    payload: EditTransferAccountPayload
  ) => EditTransferAccountAction;
  createBulkTransferRequest: (
    body: CreateBulkTransferBody
  ) => CreateRequestAction;
  loadTransferAccountList: ({
    query,
    path,
  }: LoadTransferAccountListPayload) => LoadTransferAccountAction;
}

interface OuterProps {}

interface ComponentState {
  exportModalVisible: boolean;
  importModalVisible: boolean;
  bulkTransferModalVisible: boolean;
  amount: numberInput;
  transferType: TransferTypes;
  label: string;
  selectedRowKeys: React.Key[];
  unselectedRowKeys: React.Key[];
  allSelected: boolean;
  params: string;
  searchString: string;
  awaitingEditSuccess: boolean;
  page: number;
  per_page: number;
}

type Props = StateProps & DispatchProps & OuterProps;

const mapStateToProps = (state: ReduxState): StateProps => {
  return {
    adminTier: state.login.adminTier,
    activeToken: getActiveToken(state),
    transferAccounts: state.transferAccounts,
    bulkTransfers: state.bulkTransfers,
    login: state.login,
    organisations: state.organisations,
  };
};

const mapDispatchToProps = (dispatch: any): DispatchProps => {
  return {
    editTransferAccountRequest: (payload: EditTransferAccountPayload) =>
      dispatch(EditTransferAccountAction.editTransferAccountRequest(payload)),
    createBulkTransferRequest: (body: CreateBulkTransferBody) =>
      dispatch(apiActions.create(sempoObjects.bulkTransfers, body)),
    loadTransferAccountList: ({
      query,
      path,
    }: LoadTransferAccountListPayload) =>
      dispatch(
        LoadTransferAccountAction.loadTransferAccountsRequest({ query, path })
      ),
  };
};

class StandardTransferAccountList extends React.Component<
  Props,
  ComponentState
> {
  constructor(props: Props) {
    super(props);
    const defaultDisbusement =
      props.organisations.byId[props.login.organisationId]
        .default_disbursement / 100 || 0;
    this.state = {
      exportModalVisible: false,
      importModalVisible: false,
      bulkTransferModalVisible: false,
      amount: defaultDisbusement,
      transferType: "DISBURSEMENT",
      selectedRowKeys: [],
      unselectedRowKeys: [],
      allSelected: false,
      params: "",
      label: "",
      searchString: "",
      awaitingEditSuccess: false,
      page: 1,
      per_page: 10,
    };
  }

  componentDidUpdate(prevProps: Props) {
    if (
      this.props.transferAccounts.editStatus.isRequesting == true &&
      prevProps.transferAccounts.editStatus.isRequesting == false
    ) {
      this.setState({ awaitingEditSuccess: true });
    } else if (
      this.state.awaitingEditSuccess &&
      this.props.transferAccounts.editStatus.success == true
    ) {
      this.setState({ awaitingEditSuccess: false });
      this.props.loadTransferAccountList({
        query: {
          params: this.state.params,
          search_string: this.state.searchString,
          page: this.state.page,
          per_page: this.state.per_page,
        },
      });
    }
  }

  onSelectChange = (
    selectedRowKeys: React.Key[],
    unselectedRowKeys: React.Key[],
    allSelected: boolean
  ) => {
    this.setState({
      selectedRowKeys,
      unselectedRowKeys,
      allSelected,
    });
  };

  onPaginateChange = (page: number, pageSize: number | undefined) => {
    let per_page = pageSize || 10;
    this.setState({
      page,
      per_page,
    });
  };

  toggleImportModal() {
    this.setState({ importModalVisible: !this.state.importModalVisible });
  }

  toggleExportModal() {
    this.setState({ exportModalVisible: !this.state.exportModalVisible });
  }

  showBulkTransferModal() {
    this.setState({ bulkTransferModalVisible: true });
  }

  handleBulkCancel() {
    this.setState({ bulkTransferModalVisible: false, amount: 0 });
  }

  setApproval(approve: boolean) {
    let { selectedRowKeys, unselectedRowKeys, allSelected } = this.state;

    let include_accounts, exclude_accounts;

    if (allSelected) {
      exclude_accounts = unselectedRowKeys;
    } else {
      include_accounts = selectedRowKeys;
    }

    this.props.editTransferAccountRequest({
      body: {
        approve,
        params: this.state.params,
        search_string: this.state.searchString,
        include_accounts: include_accounts,
        exclude_accounts: exclude_accounts,
      },
      path: "bulk",
    });
  }

  updateQueryData(query: Query) {
    this.setState({
      params: query.params,
      searchString: query.searchString,
      page: 1,
    });
  }

  createBulkTransferFromState() {
    let { selectedRowKeys, unselectedRowKeys, allSelected } = this.state;
    this.createBulkTransfer(selectedRowKeys, unselectedRowKeys, allSelected);
  }