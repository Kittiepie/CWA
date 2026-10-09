import { ApiResponse } from "@/lib/ApiResponse";

export default function isApiResponse<T>(response: unknown): response is ApiResponse<T> {
  return response instanceof Object
    && "success" in response
    && "message" in response
    && ("data" in response || "error" in response);
}
