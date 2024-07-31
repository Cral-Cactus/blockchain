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

  _validateData(data) {
    let businessValidation;
    if (this.state.account_type === "BUSINESS") {
      businessValidation = {
        phone_val: /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\./0-9]*$/.test(
          data.phone
        ),
        business_legal_name_val: /.*\S.*/.test(data.business_legal_name),
        business_type_val: data.business_type !== "select",
        tax_id_val: /.*\S.*/.test(data.tax_id),
        website_val: /(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]/g.test(
          data.website
        ),
        date_established_val: /^([0-2][0-9]|(3)[0-1])(\/)(((0)[0-9])|((1)[0-2]))(\/)\d{4}$/i.test(
          data.date_established
        ),
        beneficial_owners_val:
          data.beneficial_owners.filter(owner => owner.full_name !== "")
            .length > 0
      };
    }

    return {
      ...businessValidation,
      country_val: /.*\S.*/.test(data.country),
      street_address_val: /.*\S.*/.test(data.street_address),
      city_val: /.*\S.*/.test(data.city),
      region_val: /.*\S.*/.test(data.region),
      postal_code_val: /^[0-9]*\S.*$/.test(data.postal_code)
    };
  }

  _validationErrors(val) {
    const errMsgs = {
      phone_val_msg: val.phone ? "" : "Please provide a valid phone number",
      business_legal_name_val_msg: val.business_legal_name
        ? ""
        : "Please provide a business name",
      business_type_val_msg: val.business_type
        ? ""
        : "Please select a business type",
      tax_id_val_msg: val.tax_id ? "" : "Please provide your tax ID",
      website_val_msg: val.website ? "" : "Please provide a valid website",
      date_established_val_msg: val.date_established
        ? ""
        : "Please provide establishment date as dd/mm/yyyy",
      country_val_msg: val.country ? "" : "Please select a country",
      street_address_val_msg: val.street_address
        ? ""
        : "Please provide your street address",
      city_val_msg: val.city ? "" : "Please provide a city",
      region_val_msg: val.region ? "" : "Please select a region",
      postal_code_val_msg: val.postal_code
        ? ""
        : "Please provide a postal code",
      beneficial_owners_val_msg: val.beneficial_owners
        ? ""
        : "Please add at least one beneficial owner"
    };
    return errMsgs;
  }