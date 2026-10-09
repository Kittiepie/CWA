"use client";

import React, { useState } from "react";
import Link from "next/link";
import { RoomDto } from "@/types/dto/RoomDto";

// ─────────────────────────────────────────────────────────────
// Kiểu dữ liệu
// ─────────────────────────────────────────────────────────────

type RoomGridProps = {
  rooms: RoomDto[];
  total: number;
  page: number;
  limit: number;
  onPageChange: (newPage: number) => void;
  isLoading?: boolean;
};

// ─────────────────────────────────────────────────────────────
// Helper: kiểm tra phòng còn hoạt động trong 24h gần nhất
// ─────────────────────────────────────────────────────────────

function isRoomActiveRecently(lastActiveAt: string | Date | undefined): boolean {
  if (!lastActiveAt) return false;
  const diffHours = (Date.now() - new Date(lastActiveAt).getTime()) / (1000 * 60 * 60);
  return diffHours <= 24;
}

// ─────────────────────────────────────────────────────────────
// Helper: format ngày giờ tiếng Việt
// ─────────────────────────────────────────────────────────────

function formatViDate(date: string | Date | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─────────────────────────────────────────────────────────────
// Helper: rút gọn ID để hiển thị
// ─────────────────────────────────────────────────────────────

function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}...` : id;
}

// ─────────────────────────────────────────────────────────────
// Skeleton Card - hiển thị khi đang tải
// ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="room-grid-card animate-pulse">
      {/* Frame ảnh skeleton */}
      <div className="room-grid-preview skeleton-preview" />

      {/* Body skeleton */}
      <div className="room-grid-body">
        <div className="h-4 bg-gray-200 rounded w-2/3 mb-3" />
        <div className="flex gap-2 mb-3">
          <div className="h-5 bg-gray-200 rounded-full w-24" />
          <div className="h-5 bg-gray-200 rounded-full w-16" />
        </div>
        <div className="h-3 bg-gray-100 rounded w-full mb-1.5" />
        <div className="h-3 bg-gray-100 rounded w-4/5" />
      </div>

      {/* Footer skeleton */}
      <div className="room-grid-footer">
        <div className="h-8 bg-gray-200 rounded-lg w-full" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RoomCard - 1 thẻ phòng trong lưới
// ─────────────────────────────────────────────────────────────

function RoomCard({ room }: { room: RoomDto }) {
  const [copied, setCopied] = useState(false);
  const isActive = isRoomActiveRecently(room.lastActiveAt);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(room.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`room-grid-card ${isActive ? "room-grid-card--active" : ""}`}>

      {/* ── Khung ảnh trạng thái bảng vẽ ── */}
      <div className="room-grid-preview">
        {/* Badge trạng thái góc trên phải */}
        <div className="room-grid-status-badge">
          {isActive ? (
            <span className="status-badge status-badge--active">
              <span className="status-dot status-dot--active" />
              Đang hoạt động
            </span>
          ) : (
            <span className="status-badge status-badge--idle">
              <span className="status-dot status-dot--idle" />
              Không hoạt động
            </span>
          )}
        </div>

        {/* Vùng hiển thị ảnh snapshot bảng (placeholder – sẽ thêm sau) */}
        <div className="room-grid-preview-placeholder">
          <svg
            className="room-grid-preview-icon"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <p className="room-grid-preview-label">Snapshot sẽ được thêm sau</p>
        </div>
      </div>

      {/* ── Thông tin phòng ── */}
      <div className="room-grid-body">
        {/* ID phòng + nút sao chép */}
        <div className="room-grid-id-row">
          <div className="room-grid-icon">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <span className="room-grid-id" title={room.id}>
            {shortId(room.id)}
          </span>
          {/* Nút sao chép ID */}
          <button
            onClick={handleCopy}
            className="room-grid-copy-btn"
            title={copied ? "Đã sao chép!" : "Sao chép Room ID"}
          >
            {copied ? (
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>

        {/* Link đầy đủ của phòng */}
        <div className="room-grid-meta-row">
          <svg className="room-grid-meta-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span className="room-grid-meta-value room-grid-link-text">
            /room/{shortId(room.id)}
          </span>
        </div>

        {/* Lần hoạt động gần nhất */}
        <div className="room-grid-meta-row">
          <svg className="room-grid-meta-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <span className="room-grid-meta-label">Hoạt động gần nhất: </span>
            <span className="room-grid-meta-value">{formatViDate(room.lastActiveAt)}</span>
          </div>
        </div>

        {/* Thời gian tạo phòng */}
        <div className="room-grid-meta-row">
          <svg className="room-grid-meta-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <div>
            <span className="room-grid-meta-label">Tạo lúc: </span>
            <span className="room-grid-meta-value">{formatViDate(room.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* ── Nút hành động ── */}
      <div className="room-grid-footer">
        <Link
          href={`/room/${room.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="room-grid-enter-btn"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span>Vào phòng</span>
          <svg className="w-3.5 h-3.5 ml-auto opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RoomGrid - Component lưới phòng chính (export)
// ─────────────────────────────────────────────────────────────

export default function RoomGrid({
  rooms,
  total,
  page,
  limit,
  onPageChange,
  isLoading = false,
}: RoomGridProps) {
  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div>
      {/* Lưới card */}
      <div className="room-grid">
        {isLoading ? (
          // Skeleton loading – hiển thị các card giả
          Array.from({ length: Math.min(limit, 6) }).map((_, i) => (
            <SkeletonCard key={i} />
          ))
        ) : rooms.length === 0 ? (
          // Trạng thái rỗng
          <div className="room-grid-empty">
            <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-base font-semibold text-gray-600 mb-1">Không tìm thấy phòng vẽ nào</p>
            <p className="text-sm text-gray-400">Thử xóa bộ lọc hoặc tìm kiếm với từ khóa khác</p>
          </div>
        ) : (
          rooms.map((room) => <RoomCard key={room.id} room={room} />)
        )}
      </div>

      {/* Thanh phân trang */}
      <div className="admin-pagination mt-4">
        <div className="text-xs text-gray-500 font-medium">
          Hiển thị{" "}
          <span className="text-gray-900 font-semibold">{rooms.length}</span>
          {" "}trên tổng số{" "}
          <span className="text-gray-900 font-semibold">{total}</span> phòng
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
