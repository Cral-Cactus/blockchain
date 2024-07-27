import React from "react";
import { Select, InputNumber, DatePicker, Button } from "antd";
const { Option, OptGroup } = Select;

import { DefaultTheme } from "../theme";

import styled from "styled-components";
import PropTypes from "prop-types";
import { replaceUnderscores, parseEncodedParams } from "../../utils";

import moment from "moment";

import { USER_FILTER_TYPE, USER_FILTER_ATTRIBUTE } from "../../constants.js";

const propTypes = {
  possibleFilters: PropTypes.array,
  onFiltersChanged: PropTypes.func,
  visible: PropTypes.bool,
  label: PropTypes.string
};

const defaultProps = {
  possibleFilters: {},
  onFiltersChanged: () => {
    console.log("Filters changed");
  },
  visible: true,
  label: "Filter:"
};

class Filter extends React.Component {
  constructor() {
    super();

    this.state = {
      filters: [],
      selectorKeyBase: "",
      ...this.baseRuleConstructionState
    };
  }

  componentDidMount() {
    this.checkForProvidedParams();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.possibleFilters !== this.props.possibleFilters) {
      this.checkForProvidedParams();
    }
  }

  checkForProvidedParams() {
    if (
      this.props.providedParams &&
      Object.keys(this.props.possibleFilters).length > 0
    ) {
      let parsed = parseEncodedParams(
        this.props.possibleFilters,
        this.props.providedParams
      );
      this.setState({ filters: parsed });
    }
  }

  baseRuleConstructionState = {
    attribute: "select",
    filterType: "of",
    comparator: "=",
    discreteOptions: [],
    discreteSelected: [],
    GtLtThreshold: 0,
    date: moment()
  };

  handleAttributeSelectorChange = attribute => {
    let attributeProperties = this.props.possibleFilters[attribute];

    if (attributeProperties.type === USER_FILTER_TYPE.DATE_RANGE) {
      this.setState({
        attribute: attribute,
        filterType: USER_FILTER_TYPE.DATE_RANGE,
        GtLtThreshold: 0
      });
    } else if (attributeProperties.type === USER_FILTER_TYPE.INT_RANGE) {
      this.setState({
        attribute: attribute,
        filterType: USER_FILTER_TYPE.INT_RANGE,
        GtLtThreshold: 0
      });
    } else {
      this.setState({
        attribute: attribute,
        filterType: USER_FILTER_TYPE.DISCRETE,
        GtLtThreshold: 0,
        discreteSelected: [],
        discreteOptions: attributeProperties.values
      });
    }
  };

  partition = (array, isValid) =>
    array.reduce(
      ([pass, fail], elem) => {
        return isValid(elem)
          ? [[...pass, elem], fail]
          : [pass, [...fail, elem]];
      },
      [[], []]
    );

  generateOptionSubList = (keys, possibleFilters, userGroup) => {
    if (keys.length === 0) {
      return null;
    }

    let subList = keys.map(key => {
      //Here we show the label without the group in the dropdown, but with the group once selected
      let label = replaceUnderscores(possibleFilters[key]["name"] || key);
      return (
        <Option key={key} label={label}>
          {label.replace(userGroup, "")}
        </Option>
      );
    });

    if (userGroup) {
      return <OptGroup label={userGroup}>{subList}</OptGroup>;
    } else {
      return subList;
    }
  };

  optionListGenerator = (keys, possibleFilters) => {
    if (typeof keys === "undefined") {
      return null;
    }

    const [recipientKeys, senderAndOtherKeys] = this.partition(
      keys,
      el => possibleFilters[el]["sender_or_recipient"] === "recipient"
    );

    const [senderKeys, otherKeys] = this.partition(
      senderAndOtherKeys,
      el => possibleFilters[el]["sender_or_recipient"] === "sender"
    );

    return (
      <Select
        showSearch
        defaultValue="Select Attribute"
        onChange={this.handleAttributeSelectorChange}
        style={{ width: "225px" }}
        optionLabelProp="label"
      >
        {this.generateOptionSubList(otherKeys, possibleFilters)}
        {this.generateOptionSubList(senderKeys, possibleFilters, "Sender")}
        {this.generateOptionSubList(
          recipientKeys,
          possibleFilters,
          "Recipient"
        )}
      </Select>
    );
  };

  attributeSelector = () => {
    let { possibleFilters } = this.props;
    const keys =
      possibleFilters !== undefined && possibleFilters !== null
        ? Object.keys(possibleFilters).filter(key => key !== "profile_picture")
        : [];

    return (
      <div
        key={this.state.selectorKeyBase + "AS"}
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          flexFlow: "row wrap"
        }}
      >
        {this.optionListGenerator(keys, possibleFilters)}
      </div>
    );
  };

  comparatorChange = value => {
    this.setState({ comparator: value });
  };

  filterTypePicker = () => {
    let { filterType, attribute } = this.state;

    if (attribute === "select") {
      return <div />;
    }
