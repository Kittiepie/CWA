import { ApiErrorValues } from "@/lib/errors/ApiErrorValues";
import isApiResponse from "./isApiResponse";
import { FetchBaseQueryError } from "@reduxjs/toolkit/query"
import check from "check-types";

export default function parseApiErrorValue(error: unknown): ApiErrorValues | null {
  // if (error instanceof AxiosError) {
  //   const serverErrorResponse = error.response?.data;
  //   if (isApiResponse(serverErrorResponse) && !serverErrorResponse.success) {
  //     return serverErrorResponse.error;
  //   }
  // }

  const fetchError = error as FetchBaseQueryError;
  if (
    check.assigned(fetchError.data)
    && isApiResponse(fetchError.data)
    && !fetchError.data.success
  ) {
    return fetchError.data.error;
  }

  return null;
}
