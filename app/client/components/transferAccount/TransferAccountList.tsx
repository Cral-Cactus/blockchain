import * as React from "react";

import { Link } from "react-router-dom";

import { Table, Button, Checkbox, Tag, Pagination, Space, Alert } from "antd";

import { ColumnsType } from "antd/es/table";

import { ReduxState } from "../../reducers/rootReducer";
import { connect } from "react-redux";
import { formatMoney } from "../../utils";
import DateTime from "../dateTime";

interface StateProps {
  transferAccounts: any;
  users: any;
  tokens: any;
}

interface DispatchProps {}

export interface OnSelectChange {
  (
    selectedRowKeys: React.Key[],
    unselectedRowKeys: React.Key[],
    allSelected: boolean
  ): void;
}

export interface OnPaginateChange {
  (page: number, pageSize: number | undefined): void;
}

export interface Pagination {
  currentPage: number;
  items: number;
  onChange: OnPaginateChange;
}

interface stringIndexable {
  [index: string]: any;
}

interface OuterProps extends stringIndexable {
  params: string;
  searchString: string;
  orderedTransferAccounts: number[];
  actionButtons: ActionButton[];
  dataButtons: DataButton[];
  onSelectChange?: OnSelectChange;
  paginationOptions?: Pagination;
  providedSelectedRowKeys?: React.Key[];
  providedUnselectedRowKeys?: React.Key[];
  transferAccounts: any;
  users: any;
}

interface ComponentState extends stringIndexable {
  selectedRowKeys: React.Key[];
  unselectedRowKeys: React.Key[];
  allSelected: boolean;
}

export interface TransferAccount {
  key: number;
  first_name: string;
  last_name: string;
  created: string;
  balance: number;
  token_symbol: string;
}

export interface ActionButton {
  label: string;
  onClick: OnSelectChange;
  loading?: boolean;
}

export interface DataButton {
  label: string;
  onClick: () => void;
  loading?: boolean;
}

type Props = StateProps & DispatchProps & OuterProps;

const columns: ColumnsType<TransferAccount> = [
  {
    title: "Name",
    key: "name",
    ellipsis: true,
    render: (text: any, record: any) => (
      <Link
        to={"/accounts/" + record.key}
        style={{
          textDecoration: "underline",
          color: "#000000a6",
          fontWeight: 400,
        }}
      >
        {record.first_name} {record.last_name}
      </Link>
    ),
  },
  {
    title: "Role",
    key: "role",
    render: (text: any, record: any) => {
      let vendorTag = record.is_vendor && <Tag color="#e2a963">Vendor</Tag>;
      let beneficiaryTag = record.is_beneficiary && (
        <Tag color="#62afb0">Beneficiary</Tag>
      );

      return (
        <>
          {vendorTag}
          {beneficiaryTag}
        </>
      );
    },
  },
  {
    title: "Created",
    key: "created",
    render: (text: any, record: any) => (
      <DateTime created={record.created} useRelativeTime={false} />
    ),
  },
  {
    title: "Balance",
    key: "balance",
    render: (text: any, record: any) => {
      const money = formatMoney(
        record.balance / 100,
        undefined,
        undefined,
        undefined,
        record.token_symbol
      );
      return <p style={{ margin: 0 }}>{money}</p>;
    },
  },
  {
    title: "Status",
    key: "status",
    render: (text: any, record: any) =>
      record.is_approved ? (
        <Tag color="#9bdf56">Approved</Tag>
      ) : (
        <Tag color="#ff715b">Not Approved</Tag>
      ),
  },
];

const mapStateToProps = (state: ReduxState): StateProps => {
  return {
    login: state.login,
    tokens: state.tokens,
    transferAccounts: state.transferAccounts,
    users: state.users,
  };
};

const mapPartialStateToProps = (state: ReduxState): StateProps => {
  return {
    login: state.login,
    tokens: state.tokens,
  };
};

class TransferAccountList extends React.Component<Props, ComponentState> {
  constructor(props: Props) {
    super(props);

    this.state = {
      selectedRowKeys: [],
      unselectedRowKeys: [],
      allSelected: false,
      loadedPages: [1],
      allLoadedRows: [],
      params: "",
      searchString: "",
    };
  }

  componentDidMount() {
    let unselectedKeys =
      this.props.providedUnselectedRowKeys || this.state.unselectedRowKeys;
    let selectedKeys =
      this.props.providedSelectedRowKeys || this.state.selectedRowKeys;
    if (unselectedKeys.length > 0) {
      selectedKeys = this.props.orderedTransferAccounts.filter(
        (accountId: number) =>
          this.props.transferAccounts.byId[accountId] != undefined &&
          !unselectedKeys.includes(accountId)
      );
    }

    this.setState({
      selectedRowKeys: selectedKeys,
      unselectedRowKeys: unselectedKeys,
      params: this.props.params,
      searchString: this.props.searchString,
    });
  }

  componentDidUpdate(prevProps: Props) {
    if (
      this.props.transferAccounts.IdList !== prevProps.transferAccounts.IdList
    ) {
      if (
        this.state.allSelected &&
        !this.state.loadedPages.includes(
          this.props.paginationOptions?.currentPage
        )
      ) {
        this.setState({
          loadedPages: [
            ...this.state.loadedPages,
            this.props.paginationOptions?.currentPage,
          ],
        });
        this.setState({
          allLoadedRows: [
            ...new Set([
              ...this.state.allLoadedRows,
              ...this.props.orderedTransferAccounts,
            ]),
          ],
        });
        this.setState({
          selectedRowKeys: [
            ...new Set([
              ...this.state.selectedRowKeys,
              ...this.props.transferAccounts.IdList,
            ]),
          ],
        });
      }
    }
    if (
      this.props.params !== prevProps.params ||
      this.props.searchString !== prevProps.searchString
    ) {
      this.setState({
        allSelected: false,
        selectedRowKeys: [],
        unselectedRowKeys: [],
        loadedPages: [1],
        allLoadedRows: [],
      });
    }
  }