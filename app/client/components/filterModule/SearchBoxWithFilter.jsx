import React from "react";
import { connect } from "react-redux";
import { ModuleBox, Input } from "../styledElements";
import styled from "styled-components";
import matchSorter from "match-sorter";
import PropTypes from "prop-types";

import {
  LoadFilterAction,
  CreateFilterAction
} from "../../reducers/filter/actions";

import LoadingSpinner from "../loadingSpinner.jsx";
import { USER_FILTER_TYPE } from "../../constants";

import Filter from "./filter";

const propTypes = {
  withSearch: PropTypes.bool,
  toggleTitle: PropTypes.string
};

const defaultProps = {
  withSearch: true,
  toggleTitle: "Filters"
};

const mapStateToProps = state => {
  return {
    filters: state.filters,
    allowedFilters: state.allowedFilters.allowedFilterState
  };
};

const mapDispatchToProps = dispatch => {
  return {
    loadFilters: () => dispatch(LoadFilterAction.loadFilterRequest()),
    createFilter: body =>
      dispatch(CreateFilterAction.createFilterRequest({ body }))
  };
};

class SearchBoxWithFilter extends React.Component {
  constructor() {
    super();
    this.state = {
      phrase: "",
      filters: [],
      possibleFilters: null,
      filterActive: false,
      dropdownActive: false,
      saveFilterDropdown: false,
      loadFiltersDropdown: false
    };
  }

  componentDidMount() {
    let custom_attribute_dict = this.getPossibleFilters();
    this.setState({ possibleFilters: custom_attribute_dict });
  }

  componentDidUpdate(newProps) {
    if (this.props.item_list !== newProps.item_list) {
      let custom_attribute_dict = this.getPossibleFilters();
      this.setState({ possibleFilters: custom_attribute_dict });
    }
  }

  saveFilter = () => {
    this.props.createFilter({
      filter_name: this.state.filterName,
      filter_attributes: this.state.filters
    });
  };

  loadFilters = () => {
    if (!this.state.loadFiltersDropdown) {
      // load filters hasn't been clicked
      this.props.loadFilters();
    }
    // toggle dropdown
    this.setState({ loadFiltersDropdown: !this.state.loadFiltersDropdown });
  };

  loadSavedFilter = filterId => {
    const savedFilter = this.props.filters.byId[filterId];
    this.setState({
      filters: savedFilter.filter,
      filterName: savedFilter.name
    });
  };

  getPossibleFilters = () => {
    var attribute_dict = {};
    var item_list = this.props.item_list;

    const proccess_attribute = (name, value) => {
      if (value !== undefined && value !== null) {
        if (attribute_dict[name] === undefined) {
          // This means that the attribute name has not been seen at all, which means we can just create array
          attribute_dict[name] = {
            name: name, // New filter module expects a name - quick fix before we do proper filters
            values: new Set([value]),
            type:
              typeof value == "number"
                ? USER_FILTER_TYPE.INT_RANGE
                : USER_FILTER_TYPE.DISCRETE
          };
        } else {
          // Attribute name has been seen, check if attribute VALUE has been seen
          if (!attribute_dict[name].values.has(value)) {
            //hasn't been seen, so add
            attribute_dict[name].values.add(value);
          }
        }
      }
    };

    if (item_list !== undefined) {
      // get attributes names and possible values
      item_list
        .filter(item => item.custom_attributes !== undefined)
        .map(item =>
          Object.keys(item.custom_attributes).map(attribute_name => {
            let attribute_value = item.custom_attributes[attribute_name];
            proccess_attribute(attribute_name, attribute_value);
          })
        );

      item_list.map(item => {
        Object.keys(this.props.filterKeys).map(key => {
          let attribute_value = item[key];
          if (this.props.filterKeys[key] !== null) {
            proccess_attribute(
              key,
              this.props.filterKeys[key](attribute_value)
            );
          } else {
            proccess_attribute(key, attribute_value);
          }
        });
      });
    }
    return attribute_dict;
  };

  onFiltersChanged = filters => {
    this.setState({
      filters
    });
  };

  handleChange = evt => {
    this.setState({ [evt.target.name]: evt.target.value });
  };

  toggleFilter = () => {
    this.setState({ filterActive: !this.state.filterActive });
  };

  saveFilterDropdown = () => {
    this.setState({ saveFilterDropdown: !this.state.saveFilterDropdown });
  };

  applyFilter = (item_list, filter) => {
    return item_list.reduce((filtered, item) => {
      let added = false;

      const add_account = () => {
        filtered.push(item);
        added = true;
      };

      const test_conditions = (filter, value) => {
        if (
          filter.type === USER_FILTER_TYPE.DISCRETE ||
          filter.type === USER_FILTER_TYPE.BOOLEAN_MAPPING
        ) {
          if (filter.allowedValues.includes((value || "").toString())) {
            // attribute value is in allowed value, add account to filtered
            add_account();
          }
        } else if (filter.type === "<") {
          if (value < filter.threshold) {
            add_account();
          }
        } else if (filter.type === ">") {
          if (value > filter.threshold) {
            add_account();
          }
        }
      };

      //Filtering Standard Attributes
      Object.keys(item).map(attribute_name => {
        let key = filter.attribute;
        if (attribute_name === key) {
          // attribute name matches key name, apply filter test
          var attribute_value = item[attribute_name];
          if (this.props.filterKeys[key] !== null) {
            attribute_value = this.props.filterKeys[key](attribute_value);
          }

          test_conditions(filter, attribute_value);
        }
      });

      if (added === false && item.custom_attributes !== undefined) {
        //Filtering Custom Attributes
        Object.keys(item.custom_attributes).map(attribute_name => {
          if (attribute_name === filter.attribute) {
            let attribute_value = item.custom_attributes[attribute_name];
            test_conditions(filter, attribute_value);
          }
        });
      }

      return filtered;
    }, []);
  };

  render() {
    const { phrase, filters, filterActive, saveFilterDropdown } = this.state;

    var item_list = this.props.item_list;

    // Phrase Search
    if (phrase !== "") {
      item_list = matchSorter(item_list, this.state.phrase, {
        keys: this.props.searchKeys
      });
    }

    if (filters.length > 0 && item_list.length > 0) {
      this.state.filters.map(filter => {
        item_list = this.applyFilter(item_list, filter);
      });
    }

    if (this.props.filters.loadStatus.isRequesting) {
      var filterList = (
        <div style={{ padding: "1em" }}>
          <LoadingSpinner />
        </div>
      );
    } else if (this.props.filters.loadStatus.success) {
      let filterListKeys = Object.keys(this.props.filters.byId)
        .filter(id => typeof this.props.filters.byId[id] !== "undefined")
        .map(id => this.props.filters.byId[id]);
      filterList = filterListKeys.map((filter, index) => {
        return (
          <CheckboxLabel
            name={filter.id}
            key={index}
            onClick={() => this.loadSavedFilter(filter.id)}
          >
            {filter.name}
          </CheckboxLabel>
        );
      });
    } else {
      filterList = null;
    }

    if (filterActive && filters.length !== 0) {
      var savedFilters = (
        <div style={{ margin: "0 1em", position: "relative" }}>
          <ModuleBox
            style={{
              margin: 0,
              padding: 0,
              fontSize: "0.8em",
              width: "fit-content"
            }}
            onClick={this.saveFilterDropdown}
          >
            <SavedFilterButton>
              {saveFilterDropdown ? null : (
                <SVG
                  style={{ padding: "0 5px 0 0" }}
                  src="/static/media/save.svg"
                  alt={"Save filter titled: " + this.state.filterName}
                />
              )}
              {saveFilterDropdown ? "Cancel" : "Save Filter"}
            </SavedFilterButton>
          </ModuleBox>