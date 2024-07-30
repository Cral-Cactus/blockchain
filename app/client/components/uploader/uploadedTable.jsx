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

  this.clearSelected();

  if (new_normalised_step_index < 0) {
    let new_requested_attribute =
      this.props.data.requested_attributes[new_step_index];
    this.unsetHeader(new_requested_attribute[0]);
    if (increment > 0) {
      this.guessColumn(new_requested_attribute[0]);
    }
  } else {
    switch (new_normalised_step_index) {
      case 0:
        break;
      case 1:
        this.setState({ firstDataRow: null });
        break;

      default:
        break;
    }
  }

  this.setState({
    step: Math.min(
      this.state.step + increment,
      this.props.data.requested_attributes.length + 2
    ),
  });
}

handleNextClick() {
  this.handleStepIncrement(1);
}

handlePrevClick() {
  this.handleStepIncrement(-1);
}

render() {
  var columnList = Object.keys(this.dataList[0]).map((id) => {
    return {
      Header:
        id in this.state.headerPositions
          ? this.state.headerPositions[id]
          : "",
      accessor: id.toString(),
    };
  });

  var data = this.dataList.slice(this.state.firstDataRow);

  if (this.currentStepNormalisedIndex() === 0) {
    var stepSpecificFields = (
      <CustomColumnFields
        selectedColumn={this.state.selectedColumn}
        customAttributes={this.state.customAttributeList}
        customAttribute={this.state.customAttribute}
        onCustomAttributeKeyPress={(e) => this.onCustomAttributeKeyPress(e)}
        handleCustomAttributeClick={(item) =>
          this.handleCustomAttributeClick(item)
        }
        handleAddClick={() => this.handleAddClick()}
      />
    );
  } else {
    stepSpecificFields = (
      <StepSpecificFieldsContainer></StepSpecificFieldsContainer>
    );
  }

  if (this.props.saveState.saved) {
    var added = 0;
    var updated = 0;
    var errors = 0;

    var main_body = (
      <div>
        <PromptText>Save Complete</PromptText>
      </div>
    );
  } else {
    main_body = (
      <ReactTable
        data={data}
        columns={columnList}
        defaultPageSize={10}
        style={{ margin: "1em" }}
        sortable={false}
        getTheadThProps={(state, rowInfo, column, instance) => {
          return {
            onClick: (e) =>
              this.handleTableClick(e, column, rowInfo, rowInfo),
            style: {
              height: "35px",
              fontWeight: 600,
              background: "#eee",
            },
          };
        }}
        getPaginationProps={() => {
          return {
            style: {
              display: "None",
            },
          };
        }}
        getTdProps={(state, rowInfo, column, instance) => {
          if (rowInfo) {
            var background =
              column.id == this.state.selectedColumn ||
              rowInfo.index == this.state.selectedRow
                ? "#dff5f3"
                : "white";
          } else {
            background =
              column.id == this.state.selectedColumn ? "#dff5f3" : "white";
          }

          var color =
            column.id in this.state.headerPositions ||
            this.state.firstDataRow == null
              ? "#666"
              : "#ccc";

          return {
            onClick: (e) =>
              this.handleTableClick(e, column, rowInfo, instance),
            style: {
              background: background,
              color: color,
            },
          };
        }}
      />
    );
  }

  let nextText = this.currentStepNormalisedIndex() === 2 ? "Save" : "Next";

  return (
    <PageWrapper>
      <Prompt
        step={this.state.step}
        promptText={this.state.promptText}
        is_vendor={this.props.is_vendor}
        saveState={this.props.saveState.saved}
        requested_attributes={this.props.data.requested_attributes}
      />

      <div
        style={{
          display: this.props.saveState.saved ? "none" : "flex",
          justifyContent: "space-between",
        }}
      >
        <StyledButton
          onClick={() => this.handlePrevClick()}
          style={
            this.state.step === 0 ||
            this.props.saveState.isRequesting ||
            this.props.saveState.saved
              ? { opacity: 0, pointerEvents: "None" }
              : {}
          }
          label={"Previous"}
        >
          Prev
        </StyledButton>

        <StyledButton
          onClick={() => this.handleNextClick()}
          style={
            this.props.saveState.isRequesting || this.props.saveState.saved
              ? { opacity: 0, pointerEvents: "None" }
              : {}
          }
          label={nextText}
        >
          {nextText}
        </StyledButton>
      </div>

      {stepSpecificFields}

      {main_body}
    </PageWrapper>
  );
}
}

const SaveSheetFields = function (props) {
if (props.isSaving) {
  return <StepSpecificFieldsContainer>Saving...</StepSpecificFieldsContainer>;
}