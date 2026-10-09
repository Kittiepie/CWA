import { ApiResponse } from "@/lib/ApiResponse";
import { apiClient } from "./api-client";
import { UserDetails } from "@/lib/types/dto/UserDetails";
import { AUTH_URL } from "../constants";
import { AuthState } from "@/lib/types/AuthState";

export type LoginMutationBody = {
  loginKey: string;
  password: string;
};

export const authApiSlice = apiClient.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<ApiResponse<UserDetails>, LoginMutationBody>({
      query: (body) => ({
        url: `${AUTH_URL}/login`,
        method: "POST",
        body,
        credentials: "include",
      }),
      invalidatesTags: ["User", "Auth"],
    }),

    logout: builder.mutation<ApiResponse<string>, void>({
      query: () => ({
        url: `${AUTH_URL}/logout`,
        method: "POST",
        credentials: "include",
      }),
      invalidatesTags: ["User", "Auth"],
    }),

    refreshSession: builder.query<ApiResponse<AuthState>, void>({
      query: () => ({
        url: `${AUTH_URL}/refresh`,
        method: "GET",
        credentials: "include",
      }),
      providesTags: ["User", "Auth"],
    }),
  }),
});

export const {
  useLoginMutation,
  useLogoutMutation,
  useRefreshSessionQuery,
} = authApiSlice;
