"use client";

import React, { useState } from "react";
import RoomGrid from "@/components/admin/RoomGrid";
import { useGetAdminAllRoomsQuery } from "@/services/client/slice/admin.slice";

export default function AdminRoomsPage() {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const limit = 12; // Lưới hiển thị nhiều phòng hơn bảng

  const { data: roomsRes, isLoading } = useGetAdminAllRoomsQuery({
    page,
    limit,
  });

  const rawRooms = (roomsRes && roomsRes.success ? roomsRes.data.items : []) || [];
  const total = (roomsRes && roomsRes.success ? roomsRes.data.total : 0) || 0;

  // Lọc client-side theo Room ID (gõ bất kỳ phần nào của ID)
  const filteredRooms = rawRooms.filter((room: any) =>
    room.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Tiêu đề trang */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Quản lý phòng vẽ cộng tác
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Theo dõi trạng thái và truy cập trực tiếp các phòng vẽ thời gian thực trong hệ thống.
        </p>
      </div>

      {/* Thanh tìm kiếm + thống kê nhanh */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        {/* Ô tìm kiếm theo Room ID */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Tìm theo Mã phòng (Room ID)..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1); // Reset về trang đầu khi tìm kiếm
            }}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
          <svg
            className="w-4 h-4 text-gray-400 absolute left-3 top-2.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Thống kê nhanh */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
            <span className="font-medium">
              {rawRooms.filter((r: any) => {
                if (!r.lastActiveAt) return false;
                return (Date.now() - new Date(r.lastActiveAt).getTime()) <= 24 * 60 * 60 * 1000;
              }).length}
            </span>
            <span className="text-gray-400">đang hoạt động</span>
          </div>
          <div className="h-4 w-px bg-gray-200" />
          <div className="text-gray-500">
            <span className="font-semibold text-gray-700">{total}</span> phòng tổng cộng
          </div>
        </div>
      </div>

      {/* Lưới phòng vẽ */}
      <RoomGrid
        rooms={filteredRooms}
        total={searchTerm ? filteredRooms.length : total}
        page={page}
        limit={limit}
        onPageChange={(newPage) => setPage(newPage)}
        isLoading={isLoading}
      />
    </div>
  );
}
