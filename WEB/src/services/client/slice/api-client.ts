import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { BASE_URL } from "../constants";
import { EndpointBuilder } from "@reduxjs/toolkit/query";
import { RootState } from "../root-reducer";

const baseQuery = fetchBaseQuery({
  baseUrl: BASE_URL,
  credentials: "include",
  prepareHeaders: (headers, { getState }) => {
    const state = getState() as RootState;
    const accessToken = state.auth.authState?.accessToken;

    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    return headers;
  },
});

const tagTypes = [
  "User",
  "Auth",
  "Room",
];

export const apiClient = createApi({
  baseQuery,
  tagTypes,
  endpoints: () => ({}),
});

export type ApiBaseQuery = typeof baseQuery;

export type ApiBuilder = EndpointBuilder<
  ApiBaseQuery,
  typeof tagTypes[number],
  "api"
>;

