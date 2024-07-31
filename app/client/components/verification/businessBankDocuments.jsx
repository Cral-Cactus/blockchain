import React from "react";
import { connect } from "react-redux";
import styled, { ThemeProvider } from "styled-components";

import DateTime from "../dateTime.tsx";
import { BusinessVerificationAction } from "../../reducers/businessVerification/actions";

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
    backStep: () => dispatch(BusinessVerificationAction.updateActiveStep(3)),
    nextStep: () => dispatch(BusinessVerificationAction.updateActiveStep(5))
  };
};

class BusinessBankDocuments extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      reference: "bank"
    };
    this.isValidated = this.isValidated.bind(this);
  }

  handleFileChange(event, ref) {
    if (this.props.uploadState.isRequesting) {
      return;
    }

    let document = event.target.files[0];

    if (document) {
      let reader = new FileReader();

      reader.onloadend = () => {
        this.props.uploadDocument({
          document: document,
          reference: ref,
          kyc_application_id: this.props.business.id
        });
      };

      reader.readAsDataURL(document);
    }
  }

  _generateDocumentList(documents, reference) {
    return documents
      .filter(document => document.reference === reference)
      .map((document, idx) => {
        return (
          <DocumentWrapper key={idx}>
            <SVG
              src="/static/media/document.svg"
              alt={"Document " + document.user_filename}
            />
            <div>
              <DocumentTitle>{document.user_filename}</DocumentTitle>
              <DateTime created={document.created} />
            </div>
          </DocumentWrapper>
        );
      });
  }