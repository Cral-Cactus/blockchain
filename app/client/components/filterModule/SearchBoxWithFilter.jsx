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

  <SavedFilters
  style={{
    display: this.state.saveFilterDropdown ? "block" : "none"
  }}
>
  <ThresholdInput
    name="filterName"
    value={this.state.filterName}
    placeholder="Filter name..."
    onChange={this.handleChange}
    aria-label="Filter name"
  />
  <FilterText
    onClick={this.saveFilter}
    style={{ padding: "0 0 5px 10px" }}
  >
    Save Filter
  </FilterText>
</SavedFilters>
</div>
);
} else if (filterActive) {
savedFilters = (
<div style={{ margin: "0 1em", display: "flex", position: "relative" }}>
<ModuleBox
  style={{ margin: 0, padding: 0, fontSize: "0.8em" }}
  onClick={this.loadFilters}
>
  <SavedFilterButton>
    <SVG
      style={{ padding: "0 5px 0 0" }}
      src="/static/media/save.svg"
      alt={"View saved filters"}
    />
    View Saved Filters
  </SavedFilterButton>
</ModuleBox>
<SavedFilters
  style={{
    display: this.state.loadFiltersDropdown ? "block" : "none"
  }}
>
  {filterList}
</SavedFilters>
<CloseWrapper
  onClick={() =>
    this.setState({
      loadFiltersDropdown: !this.state.loadFiltersDropdown
    })
  }
  style={{ display: this.state.loadFiltersDropdown ? "" : "none" }}
/>
</div>
);
}

return (
<div>
{this.props.withSearch ? (
<ModuleBox>
  <SearchWrapper>
    <svg
      style={{
        width: 18,
        height: 18,
        paddingTop: 10,
        paddingRight: 10,
        paddingBottom: 10,
        paddingLeft: 10
      }}
      height="16"
      viewBox="0 0 16 16"
      width="16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12.6 11.2c.037.028.073.059.107.093l3 3a1 1 0 1 1-1.414 1.414l-3-3a1.009 1.009 0 0 1-.093-.107 7 7 0 1 1 1.4-1.4zM7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10z"
        fillRule="evenodd"
        fill="#6a7680"
      />
    </svg>
    <SearchInput
      name="phrase"
      value={phrase}
      placeholder="Search..."
      onChange={this.handleChange}
      aria-label="Search"
    />

    <FilterWrapper onClick={this.toggleFilter}>
      <FilterText>
        {filterActive ? "Cancel" : this.props.toggleTitle}
      </FilterText>
      <svg
        style={{
          width: 12,
          height: 12,
          padding: "0 10px",
          transform: filterActive ? "rotate(45deg)" : null,
          transition: "all .15s ease"
        }}
        height="16"
        viewBox="0 0 16 16"
        width="16"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M9 7h6a1 1 0 0 1 0 2H9v6a1 1 0 0 1-2 0V9H1a1 1 0 1 1 0-2h6V1a1 1 0 1 1 2 0z"
          fillRule="evenodd"
          fill="#6a7680"
        />
      </svg>
    </FilterWrapper>
  </SearchWrapper>
</ModuleBox>
) : (
<ModuleBox>
  <FilterWrapper onClick={this.toggleFilter}>
    <FilterText>
      {filterActive ? "Cancel" : this.props.toggleTitle}
    </FilterText>
    <svg
      style={{
        width: 12,
        height: 12,
        padding: "0 10px",
        transform: filterActive ? "rotate(45deg)" : null,
        transition: "all .15s ease"
      }}
      height="16"
      viewBox="0 0 16 16"
      width="16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M9 7h6a1 1 0 0 1 0 2H9v6a1 1 0 0 1-2 0V9H1a1 1 0 1 1 0-2h6V1a1 1 0 1 1 2 0z"
        fillRule="evenodd"
        fill="#6a7680"
      />
    </svg>
  </FilterWrapper>
</ModuleBox>
)}

{savedFilters}
{filterActive && (
<Filter
  possibleFilters={this.state.possibleFilters}
  onFiltersChanged={this.onFiltersChanged}
/>
)}

<div>
{React.cloneElement(this.props.children, { item_list: item_list })}
</div>
</div>
);
}
}

const ThresholdInput = styled(Input)`
  font: 400 12px system-ui;
  border-radius: 5px;
  height: 12px;
`;

const SVG = styled.img`
  width: 12px;
  padding: 0px 10px;
`;