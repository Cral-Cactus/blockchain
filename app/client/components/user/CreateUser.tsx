import * as React from "react";
import { connect } from "react-redux";
import { Card, Button } from "antd";

import * as styles from "./styles.module.css";
import { LoadTransferUsagesAction } from "../../reducers/transferUsage/actions";
import { TransferUsage } from "../../reducers/transferUsage/types";
import { Organisation } from "../../reducers/organisation/types";
import { ReduxState } from "../../reducers/rootReducer";
import { LoadOrganisationAction } from "../../reducers/organisation/actions";
import CreateUserForm, { ICreateUserUpdate } from "./CreateUserForm";
import { CreateUserAction } from "../../reducers/user/actions";
import { CreateUserPayload } from "../../reducers/user/types";

interface DispatchProps {
  createUser: (payload: CreateUserPayload) => CreateUserAction;
  resetCreateUser: () => CreateUserAction;
  loadTransferUsages: () => LoadTransferUsagesAction;
  loadOrganisation: () => LoadOrganisationAction;
}

interface StateProps {
  login: any;
  users: any;
  transferUsages: TransferUsage[];
  activeOrganisation?: Organisation;
}

interface ComponentState {}

type Form = ICreateUserUpdate;
type Props = DispatchProps & StateProps;

class CreateUserUpdated extends React.Component<Props, ComponentState> {
  constructor(props: Props) {
    super(props);
    this.state = {};
  }

  componentDidMount() {
    this.props.loadTransferUsages();
    this.props.loadOrganisation();
  }

  componentWillUnmount() {
    this.resetCreateUser();
  }

  resetCreateUser() {
    this.props.resetCreateUser();
  }

  onCreateUser(form: Form) {
    const { activeOrganisation } = this.props;
    let businessUsage = form.businessUsage;
    if (businessUsage && businessUsage.toLowerCase() === "other") {
      businessUsage = form.usageOtherSpecific;
    }