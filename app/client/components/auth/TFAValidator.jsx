import React from "react";
import { connect } from "react-redux";
import { Button, Checkbox, Input, Form } from "antd";

import { ValidateTfaAction } from "../../reducers/auth/actions";

const mapStateToProps = state => {
  return {
    loginState: state.login,
    validateState: state.validateTFA
  };
};

const mapDispatchToProps = dispatch => {
  return {
    validateTFARequest: payload =>
      dispatch(ValidateTfaAction.validateTFARequest(payload))
  };
};

export class TFAValidator extends React.Component {
  constructor() {
    super();
    this.state = {};
    this.onFinish = this.onFinish.bind(this);
  }

  onFinish(values) {
    this.props.validateTFARequest({
      body: {
        otp: values.otp,
        otp_expiry_interval: values.rememberComputer ? 9999 : 1
      }
    });
  }

  onFinishFailed = errorInfo => {
    console.log("Failed:", errorInfo);
  };

  render() {
    if (this.props.validateState.success) {
      return (
        <div style={{ display: "block", margin: "2em" }}>
          Two-step authentication successfully set up!
        </div>
      );
    }

    return (
      <Form
        name="basic"
        style={{ maxWidth: "300px" }}
        initialValues={{ remember: false }}
        onFinish={this.onFinish}
        onFinishFailed={this.onFinishFailed}
      >