// Điểm dữ liệu tăng trưởng theo ngày
export type DailyGrowthPoint = {
  date: string;  // định dạng: YYYY-MM-DD
  count: number;
};

// Thống kê tổng quan hệ thống
export type AdminStatsOverview = {
  totalUsers: number;
  totalRooms: number;
  totalParticipants: number;
  newUsersToday: number;
  newRoomsToday: number;
};

// Thống kê chi tiết users
export type AdminUserStats = {
  byRole: {
    admin: number;
    user: number;
    guest: number;
  };
  dailyGrowth: DailyGrowthPoint[];
};

// Thống kê chi tiết rooms
export type AdminRoomStats = {
  activeRoomsLast24h: number;
  dailyGrowth: DailyGrowthPoint[];
};

// Kết quả danh sách có phân trang
export type PaginatedResult<T> = {
  items: T[];
  total: number;
};

/**
 * Kiểu dữ liệu người dùng dành cho admin (bao gồm createdAt từ backend).
 * Tương ứng với UserDto trả về bởi AdminController.
 */
export type AdminUserItem = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user" | "guest" | string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

