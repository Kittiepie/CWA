"use client";

import React, { useState } from "react";
import Link from "next/link";
import { RoomDto } from "@/types/dto/RoomDto";

type RoomTableProps = {
  rooms: RoomDto[];
  total: number;
  page: number;
  limit: number;
  onPageChange: (newPage: number) => void;
  isLoading?: boolean;
};

/**
 * Kiểm tra xem phòng có hoạt động trong 24 giờ qua hay không
 */
function isRoomActiveRecently(lastActiveAt: string | Date | undefined): boolean {
  if (!lastActiveAt) return false;
  const lastActive = new Date(lastActiveAt).getTime();
  const now = Date.now();
  const diffHours = (now - lastActive) / (1000 * 60 * 60);
  return diffHours <= 24;
}

/**
 * RoomTable - Bảng hiển thị danh sách phòng vẽ cộng tác
 */
export default function RoomTable({
  rooms,
  total,
  page,
  limit,
  onPageChange,
  isLoading = false,
}: RoomTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const totalPages = Math.ceil(total / limit) || 1;

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="admin-table-container">
      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Mã Phòng (Room ID)</th>
              <th scope="col">Trạng thái</th>
              <th scope="col">Lần hoạt động gần nhất</th>
              <th scope="col">Thời gian tạo</th>
              <th scope="col" className="text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: limit > 5 ? 5 : limit }).map((_, index) => (
                <tr key={index} className="animate-pulse">
                  <td className="py-4"><div className="h-5 bg-gray-200 rounded w-32"></div></td>
                  <td><div className="h-6 bg-gray-200 rounded-full w-24"></div></td>
                  <td><div className="h-4 bg-gray-200 rounded w-28"></div></td>
                  <td><div className="h-4 bg-gray-200 rounded w-28"></div></td>
                  <td className="text-right"><div className="h-8 bg-gray-200 rounded w-20 ml-auto"></div></td>
                </tr>
              ))
            ) : rooms.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-500">
                  <div className="flex flex-col items-center justify-center">
                    <svg className="w-10 h-10 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <p className="text-sm font-medium">Không tìm thấy phòng vẽ nào</p>
                  </div>
                </td>
              </tr>
            ) : (
              rooms.map((room) => {
                const isActive = isRoomActiveRecently(room.lastActiveAt);
                const isCopied = copiedId === room.id;

                const formattedLastActive = room.lastActiveAt
                  ? new Date(room.lastActiveAt).toLocaleString("vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Chưa hoạt động";

                const formattedCreated = room.createdAt
                  ? new Date(room.createdAt).toLocaleString("vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—";

                return (
                  <tr key={room.id} className="hover:bg-slate-50/70 transition-colors">
                    <td>
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </div>
                        <div>
                          <div className="font-mono text-xs font-semibold text-gray-900 flex items-center gap-1.5">
                            <span>{room.id}</span>
                            <button
                              onClick={() => handleCopy(room.id)}
                              className="text-gray-400 hover:text-indigo-600 p-0.5 rounded transition"
                              title="Sao chép ID"
                            >
                              {isCopied ? (
                                <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {isActive ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Đang hoạt động
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
                          <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-slate-400"></span>
                          Không hoạt động
                        </span>
                      )}
                    </td>
                    <td className="text-sm text-gray-600 font-medium">
                      {formattedLastActive}
                    </td>
                    <td className="text-sm text-gray-500">
                      {formattedCreated}
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/room/${room.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors border border-indigo-200"
                      >
                        <span>Vào phòng</span>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </Link>
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
          Hiển thị <span className="text-gray-900 font-semibold">{rooms.length}</span> trên tổng số <span className="text-gray-900 font-semibold">{total}</span> phòng
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
