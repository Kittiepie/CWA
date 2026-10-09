import { DailyGrowthPoint } from './AdminUserStatsDto';

// DTO thống kê chi tiết về rooms
export interface AdminRoomStatsDto {
  // Số phòng đang active trong 24h qua (dựa theo lastActiveAt)
  activeRoomsLast24h: number;

  // Tăng trưởng rooms theo 30 ngày gần nhất
  dailyGrowth: DailyGrowthPoint[];
}
