"use client";

import React from "react";
import Link from "next/link";
import StatsCard from "@/components/admin/StatsCard";
import UserTable from "@/components/admin/UserTable";
import RoomTable from "@/components/admin/RoomTable";
import {
  useGetAdminStatsOverviewQuery,
  useGetAdminUserStatsQuery,
  useGetAdminRoomStatsQuery,
  useGetAdminAllUsersQuery,
  useGetAdminAllRoomsQuery,
} from "@/services/client/slice/admin.slice";

/**
 * Biểu đồ tăng trưởng dạng cột CSS trực quan và tinh tế
 */
function GrowthBarChart({
  title,
  data,
  colorType = "users",
}: {
  title: string;
  data: { date: string; count: number }[];
  colorType?: "users" | "rooms";
}) {
  // Tìm giá trị lớn nhất để chia tỉ lệ phần trăm
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  // Lấy 14 ngày gần nhất để biểu đồ không bị quá dày
  const displayData = data.slice(-14);

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <div>
          <h3 className="admin-card-title">{title}</h3>
          <p className="admin-card-subtitle">Xu hướng 14 ngày qua</p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md">
          Tổng cộng: {data.reduce((sum, item) => sum + item.count, 0)}
        </span>
      </div>

      <div className="growth-chart">
        {displayData.map((item, index) => {
          const heightPercent = Math.max((item.count / maxCount) * 100, 6);
          const dateLabel = item.date.slice(5); // Format: MM-DD

          return (
            <div key={index} className="growth-bar-col group" title={`${item.date}: ${item.count}`}>
              {/* Tooltip hiển thị khi hover */}
              <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[10px] py-0.5 px-1.5 rounded pointer-events-none whitespace-nowrap z-10">
                {item.count}
              </div>

              {/* Cột dữ liệu */}
              <div
                className={`growth-bar growth-bar--${colorType} group-hover:brightness-110`}
                style={{ height: `${heightPercent}%` }}
              ></div>

              <span className="growth-bar-label">{dateLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Biểu đồ phân bổ vai trò người dùng (Roles distribution)
 */
function RoleDistributionCard({
  byRole,
}: {
  byRole?: { admin: number; user: number; guest: number };
}) {
  const adminCount = byRole?.admin || 0;
  const userCount = byRole?.user || 0;
  const guestCount = byRole?.guest || 0;
  const total = adminCount + userCount + guestCount || 1;

  const adminPercent = Math.round((adminCount / total) * 100);
  const userPercent = Math.round((userCount / total) * 100);
  const guestPercent = Math.round((guestCount / total) * 100);

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <div>
          <h3 className="admin-card-title">Phân bổ vai trò người dùng</h3>
          <p className="admin-card-subtitle">Cơ cấu thành viên hệ thống</p>
        </div>
      </div>

      {/* Progress bar gộp 3 màu */}
      <div className="w-full h-3.5 bg-gray-100 rounded-full overflow-hidden flex mb-6">
        <div
          style={{ width: `${adminPercent}%` }}
          className="bg-red-500 transition-all duration-500"
          title={`Admin: ${adminCount} (${adminPercent}%)`}
        ></div>
        <div
          style={{ width: `${userPercent}%` }}
          className="bg-indigo-500 transition-all duration-500"
          title={`User: ${userCount} (${userPercent}%)`}
        ></div>
        <div
          style={{ width: `${guestPercent}%` }}
          className="bg-slate-400 transition-all duration-500"
          title={`Guest: ${guestCount} (${guestPercent}%)`}
        ></div>
      </div>

      {/* Legend & Số lượng */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="p-3 bg-red-50/60 rounded-xl border border-red-100">
          <div className="text-xs font-semibold text-red-700">Quản trị viên</div>
          <div className="text-xl font-bold text-red-900 mt-1">{adminCount}</div>
          <div className="text-[11px] text-red-600 font-medium">{adminPercent}%</div>
        </div>

        <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
          <div className="text-xs font-semibold text-indigo-700">Thành viên</div>
          <div className="text-xl font-bold text-indigo-900 mt-1">{userCount}</div>
          <div className="text-[11px] text-indigo-600 font-medium">{userPercent}%</div>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
          <div className="text-xs font-semibold text-slate-700">Khách</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{guestCount}</div>
          <div className="text-[11px] text-slate-600 font-medium">{guestPercent}%</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Trang Dashboard Tổng quan của Quản trị viên
 */
export default function AdminDashboardPage() {
  // Gọi các API thống kê thông qua RTK Query
  const { data: overviewRes, isLoading: isOverviewLoading } = useGetAdminStatsOverviewQuery();
  const { data: userStatsRes, isLoading: isUserStatsLoading } = useGetAdminUserStatsQuery();
  const { data: roomStatsRes, isLoading: isRoomStatsLoading } = useGetAdminRoomStatsQuery();

  // Gọi 5 bản ghi mới nhất để xem nhanh
  const { data: recentUsersRes, isLoading: isRecentUsersLoading } = useGetAdminAllUsersQuery({
    page: 1,
    limit: 5,
  });

  const { data: recentRoomsRes, isLoading: isRecentRoomsLoading } = useGetAdminAllRoomsQuery({
    page: 1,
    limit: 5,
  });

  const overview = overviewRes && overviewRes.success ? overviewRes.data : undefined;
  const userStats = userStatsRes && userStatsRes.success ? userStatsRes.data : undefined;
  const roomStats = roomStatsRes && roomStatsRes.success ? roomStatsRes.data : undefined;
  const recentUsers = (recentUsersRes && recentUsersRes.success ? recentUsersRes.data.items : []) || [];
  const recentRooms = (recentRoomsRes && recentRoomsRes.success ? recentRoomsRes.data.items : []) || [];
  const totalUsers = (recentUsersRes && recentUsersRes.success ? recentUsersRes.data.total : 0) || 0;
  const totalRooms = (recentRoomsRes && recentRoomsRes.success ? recentRoomsRes.data.total : 0) || 0;

  return (
    <div className="space-y-8">
      {/* Tiêu đề trang */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Bảng điều khiển hệ thống
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Theo dõi số liệu hoạt động, lưu lượng phòng vẽ và người dùng trong thời gian thực.
        </p>
      </div>

      {/* Grid 4 chỉ số thống kê quan trọng */}
      <div className="stats-grid">
        <StatsCard
          title="Tổng người dùng"
          value={overview?.totalUsers ?? (isOverviewLoading ? "..." : 0)}
          label="Tài khoản đã đăng ký"
          accentColor="blue"
          badge={
            overview?.newUsersToday
              ? { value: `+${overview.newUsersToday} hôm nay`, type: "increase" }
              : undefined
          }
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />

        <StatsCard
          title="Tổng phòng vẽ"
          value={overview?.totalRooms ?? (isOverviewLoading ? "..." : 0)}
          label="Phòng đã khởi tạo"
          accentColor="green"
          badge={
            overview?.newRoomsToday
              ? { value: `+${overview.newRoomsToday} hôm nay`, type: "increase" }
              : undefined
          }
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
        />

        <StatsCard
          title="Phòng đang hoạt động (24h)"
          value={roomStats?.activeRoomsLast24h ?? (isRoomStatsLoading ? "..." : 0)}
          label="Tương tác gần đây"
          accentColor="purple"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />

        <StatsCard
          title="Tổng lượt tham gia"
          value={overview?.totalParticipants ?? (isOverviewLoading ? "..." : 0)}
          label="Lượt kết nối bảng vẽ"
          accentColor="orange"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
      </div>

      {/* Grid biểu đồ xu hướng */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tăng trưởng người dùng 30 ngày */}
        <GrowthBarChart
          title="Tăng trưởng người dùng mới"
          data={userStats?.dailyGrowth || []}
          colorType="users"
        />

        {/* Phân bổ vai trò */}
        <RoleDistributionCard byRole={userStats?.byRole} />
      </div>

      {/* Danh sách người dùng mới nhất */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Người dùng mới đăng ký</h2>
          <Link
            href="/admin/users"
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            <span>Xem toàn bộ</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        <UserTable
          users={recentUsers}
          total={totalUsers}
          page={1}
          limit={5}
          onPageChange={() => {}}
          isLoading={isRecentUsersLoading}
        />
      </div>

      {/* Danh sách phòng vẽ mới nhất */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Phòng vẽ mới khởi tạo</h2>
          <Link
            href="/admin/rooms"
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            <span>Xem toàn bộ</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        <RoomTable
          rooms={recentRooms}
          total={totalRooms}
          page={1}
          limit={5}
          onPageChange={() => {}}
          isLoading={isRecentRoomsLoading}
        />
      </div>
    </div>
  );
}
