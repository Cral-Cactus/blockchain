import * as React from "react";
import { useSelector } from "react-redux";
import { useIntercom } from "react-use-intercom";

import { LoginState } from "../../reducers/auth/loginReducer";
import { ReduxState } from "../../reducers/rootReducer";

const IntercomSetup: React.FunctionComponent = () => {
  const { boot } = useIntercom();
  const loggedIn: boolean = useSelector(
    (state: ReduxState) => state.login.userId !== null
  );
  const login: LoginState = useSelector((state: ReduxState) => state.login);
  const activeOrganisation = useSelector((state: ReduxState) =>
    state.login.organisationId
      ? state.organisations.byId[state.login.organisationId]
      : undefined
  );