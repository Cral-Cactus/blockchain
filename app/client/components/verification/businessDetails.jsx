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

class BusinessDetails extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      account_type: "BUSINESS",
      first_name: "",
      last_name: "",
      phone: "",
      business_legal_name: "",
      business_type: "select",
      tax_id: "",
      website: "",
      date_established: "",
      country: "",
      street_address: "",
      street_address_2: "",
      city: "",
      region: "",
      postal_code: "",
      beneficial_owners: [{ full_name: "" }]
    };
    this._validateOnDemand = false;

    this.handleInputChange = this.handleInputChange.bind(this);
    this.selectCountry = this.selectCountry.bind(this);
    this.selectRegion = this.selectRegion.bind(this);
    this.handleBeneficialOwner = this.handleBeneficialOwner.bind(this);
    this.addOwner = this.addOwner.bind(this);
    this.validationCheck = this.validationCheck.bind(this);
    this.isValidated = this.isValidated.bind(this);
  }

  componentDidMount() {
    let { businessProfile } = this.props;

    if (businessProfile !== null && typeof businessProfile !== "undefined") {
      Object.keys(this.state).map(key => {
        if (
          businessProfile[key] !== null &&
          typeof businessProfile[key] !== "undefined"
        ) {
          this.setState({ [key]: businessProfile[key] });
        }
      });
    }
  }

  handleInputChange(event) {
    const target = event.target;
    const value = target.type === "checkbox" ? target.checked : target.value;
    const name = target.name;

    this.setState({
      [name]: value
    });
  }

  selectCountry(val) {
    this.setState({ country: val });
  }

  selectRegion(val) {
    this.setState({ region: val });
  }

  addOwner = e => {
    this.setState(prevState => ({
      beneficial_owners: [...prevState.beneficial_owners, { full_name: "" }]
    }));
  };

  handleBeneficialOwner(e) {
    let beneficial_owners = [...this.state.beneficial_owners];
    beneficial_owners[e.target.dataset.id].full_name = e.target.value;
    this.setState({ beneficial_owners: beneficial_owners });
  }

  isValidated() {
    const userInput = this._grabUserInput();
    const validateNewInput = this._validateData(userInput);
    const createBusinessProfile = {
      ...userInput,
      ...{ user_id: this.props.userId }
    };

    if (
      Object.keys(validateNewInput).every(k => {
        return validateNewInput[k] === true;
      })
    ) {
      let business = Object.keys(this.props.businessProfile);

      if (business.length > 0) {
        this.props.nextStep();
        this.props.editBusinessProfile(
          userInput,
          this.props.businessProfile.id
        );
      } else {
        this.props.nextStep();
        this.props.createBusinessProfile(createBusinessProfile);
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
    let {
      account_type,
      phone,
      business_legal_name,
      business_type,
      tax_id,
      website,
      date_established,
      country,
      street_address,
      street_address_2,
      city,
      region,
      postal_code,
      beneficial_owners
    } = this.state;
    return {
      account_type: account_type,
      phone: phone,
      business_legal_name: business_legal_name,
      business_type: business_type,
      tax_id: tax_id,
      website: website,
      date_established: date_established,
      country: country,
      street_address: street_address,
      street_address_2: street_address_2,
      city: city,
      region: region,
      postal_code: postal_code,
      beneficial_owners: beneficial_owners
    };
  }

  validationCheck() {
    if (!this._validateOnDemand) {
      return;
    }

    const userInput = this._grabUserInput();
    const validateNewInput = this._validateData(this.state);
    console.log(validateNewInput);

    this.setState(
      Object.assign(
        userInput,
        validateNewInput,
        this._validationErrors(validateNewInput)
      )
    );
  }

  render() {
    const { userId } = this.props;
    let indvidualAccount = this.state.account_type === "INDIVIDUAL";

    return (
      <div>
        {userId === null || typeof userId === "undefined" ? null : (
          <Row>
            <InputObject>
              <InputLabel>Account Type</InputLabel>
              <StyledSelectKey
                name="account_type"
                value={this.state.account_type}
                onBlur={this.validationCheck}
                onChange={this.handleInputChange}
              >
                <option name="INDIVIDUAL" value="INDIVIDUAL">
                  INDIVIDUAL
                </option>
                <option name="BUSINESS" value="BUSINESS">
                  BUSINESS
                </option>
              </StyledSelectKey>
              <ErrorMessage state={this.state} input={"account_type"} />
            </InputObject>
          </Row>
        )}

        {indvidualAccount ? null : (
          <div>
            <Row>
              <InputObject>
                <InputLabel>Phone</InputLabel>
                <ManagerInput
                  name="phone"
                  placeholder="+61411003945"
                  type="text"
                  value={this.state.phone}
                  onBlur={this.validationCheck}
                  onChange={this.handleInputChange}
                />
                <ErrorMessage state={this.state} input={"phone"} />
              </InputObject>
            </Row>

            <Row>
              <InputObject>
                <InputLabel>Business Legal Name</InputLabel>
                <ManagerInput
                  name="business_legal_name"
                  placeholder="Acme Aus"
                  type="text"
                  value={this.state.business_legal_name}
                  onBlur={this.validationCheck}
                  onChange={this.handleInputChange}
                />
                <ErrorMessage
                  state={this.state}
                  input={"business_legal_name"}
                />
              </InputObject>
            </Row>

            <Row>
              <InputObject>
                <InputLabel>Business Type</InputLabel>
                <StyledSelectKey
                  name="business_type"
                  value={this.state.business_type}
                  onBlur={this.validationCheck}
                  onChange={this.handleInputChange}
                >
                  <option name="select" value="select" disabled>
                    select attribute
                  </option>
                  <option name="partnership" value="partnership">
                    General Partnership
                  </option>
                  <option name="for_profit" value="for_profit">
                    For-Profit Corporation
                  </option>
                  <option name="limited_company" value="limited_company">
                    Limited Company
                  </option>
                  <option name="llc" value="llc">
                    Limited Liability Company (LLC)
                  </option>
                  <option name="llp" value="llp">
                    Limited Liability Partnership (LLP)
                  </option>
                  <option name="lp" value="lp">
                    Limited Partnership (LP)
                  </option>
                  <option name="non_profit" value="non_profit">
                    Non-for Profit
                  </option>
                  <option name="other" value="other">
                    Other
                  </option>
                </StyledSelectKey>
                <ErrorMessage state={this.state} input={"business_type"} />
              </InputObject>
            </Row>

            <Row>
              <InputObject>
                <InputLabel>Tax Identification Number</InputLabel>
                <ManagerInput
                  name="tax_id"
                  placeholder="Tax ID"
                  type="text"
                  value={this.state.tax_id}
                  onBlur={this.validationCheck}
                  onChange={this.handleInputChange}
                />
                <ErrorMessage state={this.state} input={"tax_id"} />
              </InputObject>
            </Row>

            <Row>
              <InputObject>
                <InputLabel>Website</InputLabel>
                <ManagerInput
                  name="website"
                  placeholder="https://acmecorp.com"
                  type="text"
                  value={this.state.website}
                  onBlur={this.validationCheck}
                  onChange={this.handleInputChange}
                />
                <ErrorMessage state={this.state} input={"website"} />
              </InputObject>
            </Row>

            <Row>
              <InputObject>
                <InputLabel>Date Business Established</InputLabel>
                <ManagerInput
                  name="date_established"
                  placeholder="dd/mm/yyyy"
                  type="text"
                  value={this.state.date_established}
                  onBlur={this.validationCheck}
                  onChange={this.handleInputChange}
                />
                <ErrorMessage state={this.state} input={"date_established"} />
              </InputObject>
            </Row>
          </div>
        )}

        <Row>
          <InputObject>
            <InputLabel>Country</InputLabel>
            <StyledCountryPicker
              name="country"
              defaultOptionLabel="Select a country"
              value={this.state.country}
              onBlur={this.validationCheck}
              onChange={val => this.selectCountry(val)}
            />
            <ErrorMessage state={this.state} input={"country"} />
          </InputObject>
        </Row>

        <Row>
          <InputObject>
            <InputLabel>Street Address</InputLabel>
            <ManagerInput
              name="street_address"
              placeholder="255 W 36th Street"
              type="text"
              value={this.state.street_address}
              onBlur={this.validationCheck}
              onChange={this.handleInputChange}
            />
            <ErrorMessage state={this.state} input={"street_address"} />
          </InputObject>
        </Row>

        <Row>
          <InputObject>
            <InputLabel>Address 2</InputLabel>
            <ManagerInput
              name="street_address_2"
              placeholder="305"
              type="text"
              value={this.state.street_address_2}
              onBlur={this.validationCheck}
              onChange={this.handleInputChange}
            />
            <ErrorMessage state={this.state} input={"street_address_2"} />
          </InputObject>
        </Row>

        <Row>
          <InputObject>
            <InputLabel>City</InputLabel>
            <ManagerInput
              name="city"
              placeholder="New York City"
              type="text"
              value={this.state.city}
              onBlur={this.validationCheck}
              onChange={this.handleInputChange}
            />
            <ErrorMessage state={this.state} input={"city"} />
          </InputObject>
        </Row>

        <Row>
          <InputObject>
            <InputLabel>Region</InputLabel>
            <StyledRegionDropdown
              blankOptionLabel="No country selected"
              defaultOptionLabel="Select a region"
              country={this.state.country}
              value={this.state.region}
              onBlur={this.validationCheck}
              onChange={this.selectRegion}
            />
            <ErrorMessage state={this.state} input={"region"} />
          </InputObject>
        </Row>