import React from "react";
import { connect } from "react-redux";

import styled, { ThemeProvider } from "styled-components";
import { BusinessVerificationAction } from "../../reducers/businessVerification/actions";
import DateTime from "../dateTime.tsx";

import { DefaultTheme } from "../theme";
import AsyncButton from "../AsyncButton.jsx";
import LoadingSpinner from "../loadingSpinner.jsx";

const UploadButton = function(props) {
  return (
    <TheRealInputButton>
      Upload File
      <InputTrigger type="file" onChange={props.handleFileChange} />
    </TheRealInputButton>
  );
};

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
    editStatus: state.businessVerification.editStatus,
    business: state.businessVerification.businessVerificationState,
    uploadState: state.businessVerification.uploadDocumentStatus
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
    uploadDocument: body =>
      dispatch(BusinessVerificationAction.uploadDocumentRequest({ body })),
    nextStep: () => dispatch(BusinessVerificationAction.updateActiveStep(2)),
    backStep: () => dispatch(BusinessVerificationAction.updateActiveStep(0))
  };
};

class BusinessDocuments extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      reference: null
    };
    this.isValidated = this.isValidated.bind(this);
  }