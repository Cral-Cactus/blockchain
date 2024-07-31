import React from "react";
import { connect } from "react-redux";
import styled, { ThemeProvider } from "styled-components";

import { ModuleHeader, Row, StyledSelect, Input } from "../styledElements";

import { DefaultTheme } from "../theme";
import AsyncButton from "../AsyncButton.jsx";

import { BusinessVerificationAction } from "../../reducers/businessVerification/actions";

const ErrorMessage = function(props) {
  var error = props.input + "_val";
  var error_message = props.input + "_val_msg";

  return (
    <div
      style={{ display: props.state[error] ? "none" : "flex", color: "red" }}
    >
      {props.state[error_message]}
    </div>
  );
};

const mapStateToProps = state => {
  return {
    createBankAccountStatus: state.businessVerification.createBankAccountStatus,
    editBankAccountStatus: state.businessVerification.editBankAccountStatus,
    businessProfile: state.businessVerification.businessVerificationState
  };
};

const mapDispatchToProps = dispatch => {
  return {
    createBankAccount: body =>
      dispatch(BusinessVerificationAction.createBankAccountRequest({ body })),
    editBankAccount: (body, path) =>
      dispatch(
        BusinessVerificationAction.editBankAccountRequest({ body, path })
      ),
    backStep: () => dispatch(BusinessVerificationAction.updateActiveStep(2))
  };
};

class BusinessBankDetails extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      routing_number: "",
      account_number: "",
      currency: "select"
    };
    this.handleInputChange = this.handleInputChange.bind(this);
    this.isValidated = this.isValidated.bind(this);
  }

  componentDidMount() {
    let { businessProfile } = this.props;

    let bank_account = businessProfile.bank_accounts[0];

    if (bank_account !== null && typeof bank_account !== "undefined") {
      Object.keys(this.state).map(key => {
        if (
          bank_account[key] !== null &&
          typeof bank_account[key] !== "undefined"
        ) {
          this.setState({ [key]: bank_account[key] });
        }
      });
    }
  }

  handleInputChange(event) {
    const target = event.target;
    const value = target.type === "checkbox" ? target.checked : target.value;
    const name = target.name;

    this.setState({
      [name]: value,
      error_message: ""
    });
  }

  isValidated() {
    const userInput = this._grabUserInput();
    const validateNewInput = this._validateData(userInput);

    if (
      Object.keys(validateNewInput).every(k => {
        return validateNewInput[k] === true;
      })
    ) {
      let bank_account = this.props.businessProfile.bank_accounts[0];

      if (bank_account !== null && typeof bank_account !== "undefined") {
        if (Object.keys(bank_account).length === 1) {
          this.props.createBankAccount(userInput);
        } else {
          this.props.editBankAccount(userInput, bank_account.id);
        }
      }
    } else {
      this.setState(
        Object.assign(
          userInput,
          validateNewInput,
          this._validationErrors(validateNewInput)
        )
      );
    }
  }

  _grabUserInput() {
    let { routing_number, account_number, currency } = this.state;
    let { businessProfile } = this.props;
    return {
      routing_number: routing_number,
      account_number: account_number,
      currency: currency,
      bank_country: businessProfile.bank_accounts[0].bank_country,
      kyc_application_id: businessProfile.id
    };
  }