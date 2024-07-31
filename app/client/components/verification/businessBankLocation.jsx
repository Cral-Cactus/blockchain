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

  componentDidMount() {
    let { businessProfile } = this.props;

    let bank_account = businessProfile.bank_accounts[0];

    if (bank_account !== null && typeof bank_account !== "undefined") {
      Object.keys(this.state).map(key => {
        if (bank_account[key] !== null) {
          this.setState({ [key]: bank_account[key] });
        }
      });
    }
  }

  selectCountry(val) {
    this.setState({ bank_country: val });
  }

    return isDataValid;
  }

  _grabUserInput() {
    let { bank_country } = this.state;
    return {
      bank_country: bank_country
    };
  }

  validationCheck() {
    if (!this._validateOnDemand) {
      return;
    }

    const userInput = this._grabUserInput();
    const validateNewInput = this._validateData(this.state);

    this.setState(
      Object.assign(
        userInput,
        validateNewInput,
        this._validationErrors(validateNewInput)
      )
    );
  }

  _validateData(data) {
    return {
      bank_country_val: /.*\S.*/.test(data.bank_country)
    };
  }

  _validationErrors(val) {
    const errMsgs = {
      bank_country_val_msg: val.bank_country ? "" : "Please select a country"
    };
    return errMsgs;
  }

  render() {
    const { businessProfile } = this.props;
    let isIndividual = businessProfile.account_type === "INDIVIDUAL";
    return (
      <div>
        <h3>Location of {isIndividual ? null : "Business"} Bank Account</h3>

        <Row>
          <InputObject>
            <InputLabel>Country</InputLabel>
            <StyledCountryPicker
              name="country"
              defaultOptionLabel="Select a country"
              value={this.state.bank_country}
              onBlur={this.validationCheck}
              onChange={val => this.selectCountry(val)}
            />
            <ErrorMessage state={this.state} input={"bank_country"} />
          </InputObject>
        </Row>

        <ThemeProvider theme={DefaultTheme}>
          <div>
            <AsyncButton
              buttonText={<span>Back</span>}
              onClick={this.props.backStep}
              label={"Back"}
            />
            <AsyncButton
              buttonText={<span>Next</span>}
              onClick={this.isValidated}
              label={"Next"}
            />
          </div>
        </ThemeProvider>
      </div>
    );
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(BusinessBankLocation);

const SecondaryText = styled.p`
  color: #555555;
  font-size: 12px;
  padding-top: 0;
  margin: 0;
  font-weight: 600;
`;

const StyledCountryPicker = styled(CountryDropdown)`
  box-shadow: 0 0 0 1px rgba(44, 45, 48, 0.15);
  font: 400 12px system-ui !important;
  color: #777;
  padding: 0 0 0 10px;
  margin: 5px;
  line-height: 25px;
  height: 25px;
  outline: none;
  border: 0;
  white-space: nowrap;
  display: inline-block;
  background: ${props => props.theme.background};
  font-size: 1em;
  font-weight: 200;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  text-decoration: none;
  -webkit-transition: all 0.15s ease;
  transition: all 0.15s ease;
  &:hover {
    //background-color: #34b0b3;
    background-color: ${props => props.theme.backgroundColor};
  }
`;