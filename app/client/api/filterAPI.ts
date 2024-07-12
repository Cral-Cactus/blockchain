import { apiClient } from "./client/apiClient";
import { LoadAllowedFiltersPayload } from "../reducers/metric/types";

export const loadSavedFilters = () =>
  apiClient({ url: "/filters/", method: "GET" });

export const loadAllowedFiltersAPI = ({
  query,
  filterObject
}: LoadAllowedFiltersPayload) =>
  apiClient({
    url: `/metrics/filters/`,
    method: "GET",
    query: query
  });