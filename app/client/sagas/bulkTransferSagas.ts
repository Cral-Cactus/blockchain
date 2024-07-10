import { takeEvery, all } from "redux-saga/effects";

import { browserHistory } from "../createStore";

import { createActionTypes } from "../genericState/actions";
import { stengoObjects } from "../reducers/rootReducer";

interface SuccessAction {
  type: string;
  id: number;
}

function* navigateToBulkDetails({ id }: SuccessAction) {
  browserHistory.push(`/bulk/${id}`);
}

function* watchCreateSuccess() {
  yield takeEvery(
    createActionTypes.success(stengoObjects.bulkTransfers.name),
    navigateToBulkDetails
  );
}

export default function* bulkTransferSagas() {
  yield all([watchCreateSuccess()]);
}