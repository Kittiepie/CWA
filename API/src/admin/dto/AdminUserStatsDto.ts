// Thống kê tăng trưởng theo từng ngày (dùng cho chart)
export interface DailyGrowthPoint {
  // Ngày thống kê (định dạng: YYYY-MM-DD)
  date: string;

  // Số lượng bản ghi trong ngày đó
  count: number;
}

// DTO thống kê chi tiết về users
export interface AdminUserStatsDto {
  // Phân bổ user theo role
  byRole: {
    admin: number;
    user: number;
    guest: number;
  };

  // Tăng trưởng user theo 30 ngày gần nhất
  dailyGrowth: DailyGrowthPoint[];
}
