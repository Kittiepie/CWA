"use client";

import React, { useState } from "react";
import UserTable from "@/components/admin/UserTable";
import { useGetAdminAllUsersQuery } from "@/services/client/slice/admin.slice";

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const limit = 10;

  const { data: usersRes, isLoading } = useGetAdminAllUsersQuery({
    page,
    limit,
  });

  const rawUsers = (usersRes && usersRes.success ? usersRes.data.items : []) || [];
  const total = (usersRes && usersRes.success ? usersRes.data.total : 0) || 0;

  // Lọc client-side theo từ khóa và vai trò nếu người dùng nhập
  const filteredUsers = rawUsers.filter((user: any) => {
    const displayName = user.name || "";
    const matchesSearch =
      displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.id && user.id.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRole = roleFilter === "all" || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Tiêu đề trang */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Quản lý người dùng
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Xem danh sách, tìm kiếm và kiểm soát phân quyền tài khoản trên toàn hệ thống.
        </p>
      </div>

      {/* Bộ lọc và Tìm kiếm */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        {/* Ô tìm kiếm */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Tìm theo tên, email hoặc ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
          <svg
            className="w-4 h-4 text-gray-400 absolute left-3 top-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Lọc theo Role */}
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">Vai trò:</span>
          <div className="flex bg-gray-100 p-1 rounded-lg">
            {[
              { key: "all", label: "Tất cả" },
              { key: "admin", label: "Admin" },
              { key: "user", label: "User" },
              { key: "guest", label: "Guest" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setRoleFilter(tab.key)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  roleFilter === tab.key
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bảng danh sách Users */}
      <UserTable
        users={filteredUsers}
        total={searchTerm || roleFilter !== "all" ? filteredUsers.length : total}
        page={page}
        limit={limit}
        onPageChange={(newPage) => setPage(newPage)}
        isLoading={isLoading}
      />
    </div>
  );
}
