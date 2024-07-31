import React from "react";
import { connect } from "react-redux";
import styled, { ThemeProvider } from "styled-components";

import { Row, Input, StyledSelect } from "../styledElements";

import { CountryDropdown, RegionDropdown } from "react-country-region-selector";
import { BusinessVerificationAction } from "../../reducers/businessVerification/actions";
import AsyncButton from "../AsyncButton.jsx";
import { DefaultTheme } from "../theme.js";

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

const mapStateToProps = (state, ownProps) => {
  return {
    userId: ownProps.userId,
    editStatus: state.businessVerification.editStatus,
    businessProfile: state.businessVerification.businessVerificationState
  };
};

const mapDispatchToProps = dispatch => {
  return {
    editBusinessProfile: (body, path) =>
      dispatch(
        BusinessVerificationAction.editBusinessVerificationRequest({
          body,
          path
        })
      ),
    createBusinessProfile: body =>
      dispatch(
        BusinessVerificationAction.createBusinessVerificationRequest({ body })
      ),
    nextStep: () => dispatch(BusinessVerificationAction.updateActiveStep(1))
  };
};
