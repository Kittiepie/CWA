"use client";

import { ApiResponse } from "@/lib/ApiResponse";
import { apiClient } from "./api-client";
import { ADMIN_URL } from "../constants";
import {
  AdminStatsOverview,
  AdminUserStats,
  AdminRoomStats,
  AdminUserItem,
  PaginatedResult,
} from "@/lib/types/dto/AdminDto";
import { RoomDto } from "@/types/dto/RoomDto";

// Tham số phân trang cho các endpoint danh sách
export type PaginationParams = {
  page?: number;
  limit?: number;
};

/**
 * Admin API slice - sử dụng RTK Query để gọi các admin endpoints.
 * Tất cả endpoints đều yêu cầu access token của admin.
 */
export const adminApiSlice = apiClient.injectEndpoints({
  endpoints: (builder) => ({
    // ── THỐNG KÊ ──────────────────────────────────────────

    // Lấy số liệu tổng quan (total users, rooms, participants)
    getAdminStatsOverview: builder.query<ApiResponse<AdminStatsOverview>, void>({
      query: () => ({
        url: `${ADMIN_URL}/stats/overview`,
        method: "GET",
      }),
    }),

    // Lấy thống kê chi tiết về users (theo role + tăng trưởng 30 ngày)
    getAdminUserStats: builder.query<ApiResponse<AdminUserStats>, void>({
      query: () => ({
        url: `${ADMIN_URL}/stats/users`,
        method: "GET",
      }),
    }),

    // Lấy thống kê chi tiết về rooms (active + tăng trưởng 30 ngày)
    getAdminRoomStats: builder.query<ApiResponse<AdminRoomStats>, void>({
      query: () => ({
        url: `${ADMIN_URL}/stats/rooms`,
        method: "GET",
      }),
    }),

    // ── DANH SÁCH ──────────────────────────────────────────

    // Lấy danh sách tất cả users có phân trang
    getAdminAllUsers: builder.query<
      ApiResponse<PaginatedResult<AdminUserItem>>,
      PaginationParams
    >({
      query: ({ page = 1, limit = 20 } = {}) => ({
        url: `${ADMIN_URL}/users`,
        method: "GET",
        params: { page, limit },
      }),
      providesTags: ["User"],
    }),

    // Lấy danh sách tất cả rooms có phân trang
    getAdminAllRooms: builder.query<
      ApiResponse<PaginatedResult<RoomDto>>,
      PaginationParams
    >({
      query: ({ page = 1, limit = 20 } = {}) => ({
        url: `${ADMIN_URL}/rooms`,
        method: "GET",
        params: { page, limit },
      }),
      providesTags: ["Room"],
    }),
  }),
});

// Export các hooks được RTK Query tự động tạo ra
export const {
  useGetAdminStatsOverviewQuery,
  useGetAdminUserStatsQuery,
  useGetAdminRoomStatsQuery,
  useGetAdminAllUsersQuery,
  useGetAdminAllRoomsQuery,
} = adminApiSlice;
