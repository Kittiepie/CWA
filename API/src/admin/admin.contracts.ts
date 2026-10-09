import { UserDto } from 'src/user/entity/user.entity';
import { RoomDto } from 'src/room/entity/room.entity';
import { AdminStatsOverviewDto } from './dto/AdminStatsOverviewDto';
import { AdminUserStatsDto } from './dto/AdminUserStatsDto';
import { AdminRoomStatsDto } from './dto/AdminRoomStatsDto';

// Interface định nghĩa khả năng đọc dữ liệu tổng quan cho admin
export interface AdminStatsReader {
  // Lấy thống kê tổng quan hệ thống
  getStatsOverview(): Promise<AdminStatsOverviewDto>;

  // Lấy thống kê chi tiết về users
  getUserStats(): Promise<AdminUserStatsDto>;

  // Lấy thống kê chi tiết về rooms
  getRoomStats(): Promise<AdminRoomStatsDto>;
}

// Interface định nghĩa khả năng đọc danh sách cho admin
export interface AdminListReader {
  // Lấy danh sách tất cả users có phân trang
  getAllUsers(page: number, limit: number): Promise<{ items: UserDto[]; total: number }>;

  // Lấy danh sách tất cả rooms có phân trang
  getAllRooms(page: number, limit: number): Promise<{ items: RoomDto[]; total: number }>;
}

// Token injection cho Dependency Injection của NestJS
export const ADMIN_STATS_READER = Symbol('ADMIN_STATS_READER');
export const ADMIN_LIST_READER = Symbol('ADMIN_LIST_READER');
