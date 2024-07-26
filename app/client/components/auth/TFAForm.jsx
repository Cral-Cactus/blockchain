import React from "react";
import styled from "styled-components";
import QRCode from "qrcode.react";
import { Button } from "antd";

import TFAValidator from "./TFAValidator.jsx";

import { FooterLink } from "../pages/authPage.jsx";

export default class TFAForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showQR: props.tfaURL ? true : false
    };
  }

  handleNextBack() {
    this.setState({
      showQR: !this.state.showQR
    });
  }

  render() {
    if (this.state.showQR) {
      return (
        <div>
          <TFAQr data={this.props.tfaURL} />
          <Button
            onClick={() => this.handleNextBack()}
            type={"primary"}
            label={
              "Go to the next page once two factor authentication QR code is scanned"
            }
            block
          >
            Next
          </Button>
        </div>
      );
    } else {
      return (
        <div>
          <TFAValidator />
          {this.props.tfaURL ? (
            <div onClick={() => this.handleNextBack()}>
              <FooterLink to={"#"}>Back</FooterLink>
            </div>
          ) : (
            <div></div>
          )}
        </div>
      );
    }
  }
}