import React from "react";

export default class StepWizard extends React.Component {
  render() {
    let { steps, activeStep } = this.props;

    let header = (
      <ol className="progtrckr">
        {steps.map((step, idx) => {
          return (
            <li
              className={
                "progtrckr-" +
                (idx === activeStep
                  ? "doing"
                  : idx > activeStep
                  ? "todo"
                  : "done") +
                " no-hl"
              }
              key={idx}
            >
              <em>{idx}</em>
              <span>{step.name}</span>
            </li>
          );
        })}
      </ol>
    );

    let activeComponent = steps[activeStep].component;

    return (
      <div className="step-progress">
        <div className="multi-step">
          {header}
          {activeComponent}
        </div>
      </div>
    );
  }
}