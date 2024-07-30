import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import ReactTable from "react-table";

import { StyledButton, Input } from "../styledElements";

import { SpreadsheetAction } from "../../reducers/spreadsheet/actions";

const mapStateToProps = (state) => {
  return {
    saveState: state.datasetSave,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    saveDataset: (body) =>
      dispatch(SpreadsheetAction.saveDatasetRequest({ body })),
    resetUploadState: () => dispatch(SpreadsheetAction.resetUploadState()),
  };
};

class uploadedTable extends React.Component {
  constructor() {
    super();
    this.state = {
      step: 0,
      selectedRow: null,
      selectedColumn: null,
      firstDataRow: null,
      headerPositions: {},
      customAttributeList: [],
      customAttribute: null,
      country: "",
      saveName: "",
      saveError: null,
    };
    this.keyFunction = this.keyFunction.bind(this);
  }

  componentWillMount() {
    this.dataList = Object.keys(this.props.data.table_data).map(
      (id) => this.props.data.table_data[id]
    );
  }
  componentDidMount() {
    document.addEventListener("keydown", this.keyFunction, false);

    this.guessColumn(this.props.data.requested_attributes[0][0]);

    if (this.props.data.requested_attributes.length > 0) {
    }
  }
  componentWillUnmount() {
    this.props.resetUploadState();
    document.removeEventListener("keydown", this.keyFunction, false);
  }

  keyFunction(event) {
    if (event.keyCode === 13) {
      if (this.state.customAttribute === null) {
        this.handleNextClick();
      } else {
        this.handleAddClick();
      }
    }
  }

  currentStepNormalisedIndex() {
    return this.state.step - this.props.data.requested_attributes.length;
  }

  setHeader(headerName) {
    var headerPositions = this.state.headerPositions;

    headerPositions[this.state.selectedColumn] = headerName;
    this.setState({
      headerPositions: headerPositions,
    });
  }

  unsetHeader(headerName) {
    var headerPositions = this.state.headerPositions;

    Object.keys(headerPositions).forEach((key) => {
      if (headerPositions[key] === headerName) {
        delete headerPositions[key];

        this.setState({
          selectedColumn: key,
        });
      }
    });

    this.setState({
      headerPositions: headerPositions,
    });
  }

  clearSelected() {
    this.setState({
      selectedRow: null,
      selectedColumn: null,
    });
  }

  processAndSaveDataset() {
    var dataset = {
      data: this.dataList.slice(this.state.firstDataRow),
      headerPositions: this.state.headerPositions,
      customAttributes: this.state.customAttributeList,
      country: this.state.country,
      saveName: this.state.saveName,
    };

    this.props.saveDataset(dataset);
  }

  onCustomAttributeKeyPress(e) {
    console.log(e);
    var customAttribute = e.target.value;
    this.setState({ customAttribute: customAttribute });
    if (e.nativeEvent.keyCode != 13) return;
    this.handleAddClick();
  }

  handleCustomAttributeClick(attribute) {
    console.log(attribute);
    this.unsetHeader(attribute);

    var newCustomAttributeList = this.state.customAttributeList;

    var index = newCustomAttributeList.indexOf(attribute);
    if (index > -1) {
      newCustomAttributeList.splice(index, 1);
    }

    this.setState({ customAttributeList: newCustomAttributeList });
  }

  handleAddClick() {
    this.setHeader(this.state.customAttribute);

    var newcustomAttributeList = this.state.customAttributeList;
    newcustomAttributeList.push(this.state.customAttribute);

    this.setState({
      customAttribute: null,
      customAttributeList: newcustomAttributeList,
    });

    this.clearSelected();
  }

  handleTableClick(e, column, rowInfo, instance) {
    console.log(this.currentStepNormalisedIndex());

    let normalised_index = this.currentStepNormalisedIndex();
    if (normalised_index < 0) {
      this.setState({
        selectedColumn:
          this.state.selectedColumn === column.id ? null : column.id,
      });
    } else if (normalised_index === 0) {
      this.setState(
        {
          selectedColumn:
            this.state.selectedColumn === column.id ? null : column.id,
        },
        () => {
          let first_row_item =
            this.props.data.table_data[0][this.state.selectedColumn];
          if (first_row_item) {
            this.setState({ customAttribute: first_row_item });
          }
        }
      );
    } else if (normalised_index === 1) {
      this.setState({
        selectedRow:
          this.state.selectedRow === rowInfo.index ? null : rowInfo.index,
      });
    }
  }

  onCountryInputKeyPress(e) {
    var country = e.target.value;
    this.setState({ country: country, saveError: null });
  }

  onSaveNameKeyPress(e) {
    var saveName = e.target.value;
    this.setState({ saveName: saveName, saveError: null });
    if (e.nativeEvent.keyCode != 13) return;
    this.handleNextClick();
  }

  guessColumn(requested_attribute_name) {
    let column_index_guess =
      this.props.data.column_firstrows[requested_attribute_name];

    console.log("guess", column_index_guess);

    if (isFinite(column_index_guess)) {
      this.setState({
        selectedColumn: column_index_guess,
      });
    }
  }

  handleStepIncrement(increment) {
    var current_step_index = this.state.step;
    var current_normalised_step_index =
      this.state.step - this.props.data.requested_attributes.length;

    var new_step_index = current_step_index + increment;
    var new_normalised_step_index = current_normalised_step_index + increment;

    if (current_normalised_step_index < 0) {
      var requested_attribute =
        this.props.data.requested_attributes[current_step_index];
      this.setHeader(requested_attribute[0]);
    } else {
      switch (current_normalised_step_index) {
        case 0:
          break;
        case 1:
          this.setState({
            selectedRow: null,
            firstDataRow: this.state.selectedRow || 0,
          });
          break;

        default:
          this.processAndSaveDataset();
          break;
      }
    }