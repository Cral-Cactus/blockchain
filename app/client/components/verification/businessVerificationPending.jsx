import React from "react";
import styled from "styled-components";

export default class BusinessVerificationPending extends React.Component {
  render() {
    return (
      <div>
        <h3>Pending Verification</h3>
      </div>
    );
  }
}

const SecondaryText = styled.p`
  color: #555555;
  font-size: 12px;
  padding-top: 0;
  margin: 0;
  font-weight: 600;
`;