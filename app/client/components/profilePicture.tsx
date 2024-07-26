import React from "react";
import styled from "styled-components";

interface Props {
  roll?: number;
  sublabel?: JSX.Element | null;
  label?: string;
  url?: string;
}

export default function ProfilePicture(props: Props) {
  const { roll, sublabel, label, url } = props;
  if (roll) {
    var quantised_roll = Math.floor(roll / 90 + 0.5) * -90;
  } else {
    quantised_roll = 0;
  }
  let _sublabel = sublabel;
  if (sublabel) {
    _sublabel = (
      <SublabelContainer>
        <Label style={{ padding: "0.2em" }}>{sublabel}</Label>
      </SublabelContainer>
    );
  } else {
    _sublabel = null;
  }