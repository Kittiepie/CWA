"use client";

import React from "react";

export type AdminUserRow = {
  id: string;
  name: string;         // Tên hiển thị của người dùng (từ backend UserDto)
  email: string;
  role: "admin" | "user" | "guest" | string;
  createdAt?: string | Date; // Ngày tạo tài khoản
};

type UserTableProps = {
  users: AdminUserRow[];
  total: number;
  page: number;
  limit: number;
  onPageChange: (newPage: number) => void;
  isLoading?: boolean;
};

/**
 * Component hiển thị badge vai trò của người dùng
 */
function RoleBadge({ role }: { role: string }) {
  const roleStyles: Record<string, { bg: string; text: string; label: string }> = {
    admin: { bg: "bg-red-50 text-red-700 border-red-200", text: "text-red-700", label: "Quản trị viên" },
    user: { bg: "bg-blue-50 text-blue-700 border-blue-200", text: "text-blue-700", label: "Thành viên" },
    guest: { bg: "bg-gray-50 text-gray-600 border-gray-200", text: "text-gray-600", label: "Khách" },
  };

  const style = roleStyles[role] || {
    bg: "bg-purple-50 text-purple-700 border-purple-200",
    text: "text-purple-700",
    label: role,
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style.bg}`}
    >
      <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-current opacity-70"></span>
      {style.label}
    </span>
  );
}

/**
 * UserTable - Bảng danh sách người dùng dành cho Admin
 * Hỗ trợ phân trang, loading skeleton, hiển thị avatar viết tắt
 */
export default function UserTable({
  users,
  total,
  page,
  limit,
  onPageChange,
  isLoading = false,
}: UserTableProps) {
  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="admin-table-container">
      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Người dùng</th>
              <th scope="col">Email</th>
              <th scope="col">Vai trò</th>
              <th scope="col">Ngày tham gia</th>
              <th scope="col" className="text-right">Mã ID</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              // Skeleton loading khi đang tải
              Array.from({ length: limit > 5 ? 5 : limit }).map((_, index) => (
                <tr key={index} className="animate-pulse">
                  <td className="py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-full bg-gray-200"></div>
                      <div className="h-4 bg-gray-200 rounded w-24"></div>
                    </div>
                  </td>
                  <td><div className="h-4 bg-gray-200 rounded w-36"></div></td>
                  <td><div className="h-6 bg-gray-200 rounded-full w-20"></div></td>
                  <td><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                  <td className="text-right"><div className="h-4 bg-gray-200 rounded w-16 ml-auto"></div></td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-500">
                  <div className="flex flex-col items-center justify-center">
                    <svg className="w-10 h-10 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <p className="text-sm font-medium">Không tìm thấy người dùng nào</p>
                  </div>
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const displayName = user.name || "Người dùng";
                const initial = displayName.charAt(0).toUpperCase();
                const formattedDate = user.createdAt
                  ? new Date(user.createdAt).toLocaleDateString("vi-VN", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : "—";

                return (
                  <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                    <td>
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center font-semibold text-sm shadow-sm">
                          {initial}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 text-sm">
                            {displayName}
                          </div>
                          <div className="text-xs text-gray-400 font-mono">
                            @{displayName.toLowerCase().replace(/\s+/g, "")}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="text-sm text-gray-600 font-medium">
                      {user.email || "—"}
                    </td>
                    <td>
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="text-sm text-gray-500">
                      {formattedDate}
                    </td>
                    <td className="text-right">
                      <span className="inline-block font-mono text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                        #{user.id.length > 8 ? `${user.id.slice(0, 8)}...` : user.id}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Phân trang */}
      <div className="admin-pagination">
        <div className="text-xs text-gray-500 font-medium">
          Hiển thị <span className="text-gray-900 font-semibold">{users.length}</span> trên tổng số <span className="text-gray-900 font-semibold">{total}</span> người dùng
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || isLoading}
            className="pagination-btn"
            aria-label="Trang trước"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Trước</span>
          </button>

          <span className="text-xs font-semibold px-3 py-1 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100">
            Trang {page} / {totalPages}
          </span>

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || isLoading}
            className="pagination-btn"
            aria-label="Trang sau"
          >
            <span className="hidden sm:inline">Sau</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
