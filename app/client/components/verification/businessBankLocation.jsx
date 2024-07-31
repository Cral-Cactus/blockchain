import React from "react";
import { connect } from "react-redux";
import styled, { ThemeProvider } from "styled-components";

import { InputLabel, InputObject, Row } from "../styledElements";

import { CountryDropdown } from "react-country-region-selector";
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
    businessProfile: state.businessVerification.businessVerificationState
  };
};

const mapDispatchToProps = dispatch => {
  return {
    updateBusinessState: kyc_application =>
      dispatch(
        BusinessVerificationAction.updateBusinessVerificationState(
          kyc_application
        )
      ),
    nextStep: () => dispatch(BusinessVerificationAction.updateActiveStep(3)),
    backStep: () => dispatch(BusinessVerificationAction.updateActiveStep(1))
  };
};

class BusinessBankLocation extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      bank_country: ""
    };
    this._validateOnDemand = true;

    this.selectCountry = this.selectCountry.bind(this);
    this.validationCheck = this.validationCheck.bind(this);
    this.isValidated = this.isValidated.bind(this);
  }