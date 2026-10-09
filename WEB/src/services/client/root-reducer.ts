import { combineReducers } from "@reduxjs/toolkit";
import { apiClient } from "./slice/api-client";
import authStateSlice from "./slice/auth-state.slice";

export const rootReducer = combineReducers({
  [apiClient.reducerPath]: apiClient.reducer,
  auth: authStateSlice.reducer,
});

export type RootState = ReturnType<typeof rootReducer>;
