import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { UserEntity, UserDto } from 'src/user/entity/user.entity';
import { RoomEntity, RoomDto } from 'src/room/entity/room.entity';
import { ParticipantEntity } from 'src/room/entity/participant.entity';
import { AdminStatsReader, AdminListReader } from './admin.contracts';
import { AdminStatsOverviewDto } from './dto/AdminStatsOverviewDto';
import { AdminUserStatsDto, DailyGrowthPoint } from './dto/AdminUserStatsDto';
import { AdminRoomStatsDto } from './dto/AdminRoomStatsDto';

@Injectable()
export class AdminService implements AdminStatsReader, AdminListReader {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,

    @InjectRepository(RoomEntity)
    private readonly roomRepository: Repository<RoomEntity>,

    @InjectRepository(ParticipantEntity)
    private readonly participantRepository: Repository<ParticipantEntity>,
  ) {}

  // ─────────────────────────────────────────────
  // THỐNG KÊ TỔNG QUAN
  // ─────────────────────────────────────────────

  /**
   * Lấy thống kê tổng quan: số lượng users, rooms, participants
   * và số user/room mới được tạo trong ngày hôm nay.
   */
  async getStatsOverview(): Promise<AdminStatsOverviewDto> {
    // Mốc thời gian đầu ngày hôm nay (giờ 0:00:00)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Chạy song song các query để tăng hiệu suất
    const [
      totalUsers,
      totalRooms,
      totalParticipants,
      newUsersToday,
      newRoomsToday,
    ] = await Promise.all([
      this.userRepository.count(),
      this.roomRepository.count(),
      this.participantRepository.count(),

      // Đếm user đăng ký từ đầu ngày hôm nay
      this.userRepository.count({
        where: { createdAt: MoreThan(today) },
      }),

      // Đếm room tạo từ đầu ngày hôm nay
      this.roomRepository.count({
        where: { createdAt: MoreThan(today) },
      }),
    ]);

    return {
      totalUsers,
      totalRooms,
      totalParticipants,
      newUsersToday,
      newRoomsToday,
    };
  }

  // ─────────────────────────────────────────────
  // THỐNG KÊ USERS
  // ─────────────────────────────────────────────

  /**
   * Thống kê chi tiết về users:
   * - Phân bổ theo role (admin/user/guest)
   * - Tăng trưởng theo 30 ngày gần nhất
   */
  async getUserStats(): Promise<AdminUserStatsDto> {
    // Đếm số user theo từng role song song
    const [adminCount, userCount, guestCount] = await Promise.all([
      this.userRepository.count({ where: { role: 'admin' } }),
      this.userRepository.count({ where: { role: 'user' } }),
      this.userRepository.count({ where: { role: 'guest' } }),
    ]);

    // Lấy dữ liệu tăng trưởng 30 ngày bằng TypeORM raw query
    const dailyGrowth = await this.getDailyGrowth(this.userRepository);

    return {
      byRole: {
        admin: adminCount,
        user: userCount,
        guest: guestCount,
      },
      dailyGrowth,
    };
  }

  // ─────────────────────────────────────────────
  // THỐNG KÊ ROOMS
  // ─────────────────────────────────────────────

  /**
   * Thống kê chi tiết về rooms:
   * - Số phòng active trong 24h qua
   * - Tăng trưởng theo 30 ngày gần nhất
   */
  async getRoomStats(): Promise<AdminRoomStatsDto> {
    // Mốc thời gian 24h trước
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [activeRoomsLast24h, dailyGrowth] = await Promise.all([
      // Phòng có lastActiveAt trong 24h gần nhất
      this.roomRepository.count({
        where: { lastActiveAt: MoreThan(last24h) },
      }),

      // Tăng trưởng rooms 30 ngày
      this.getDailyGrowth(this.roomRepository),
    ]);

    return {
      activeRoomsLast24h,
      dailyGrowth,
    };
  }

  // ─────────────────────────────────────────────
  // DANH SÁCH (có phân trang)
  // ─────────────────────────────────────────────

  /**
   * Lấy danh sách tất cả users với phân trang.
   * @param page - Số trang (bắt đầu từ 1)
   * @param limit - Số bản ghi mỗi trang
   */
  async getAllUsers(
    page: number,
    limit: number,
  ): Promise<{ items: UserDto[]; total: number }> {
    const [users, total] = await this.userRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: users.map((u) => u.toDto()),
      total,
    };
  }

  /**
   * Lấy danh sách tất cả rooms với phân trang.
   * @param page - Số trang (bắt đầu từ 1)
   * @param limit - Số bản ghi mỗi trang
   */
  async getAllRooms(
    page: number,
    limit: number,
  ): Promise<{ items: RoomDto[]; total: number }> {
    const [rooms, total] = await this.roomRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: rooms.map((r) => r.toDto()),
      total,
    };
  }

  // ─────────────────────────────────────────────
  // HELPER METHODS
  // ─────────────────────────────────────────────

  /**
   * Tính tăng trưởng theo ngày trong 30 ngày gần nhất.
   * Sử dụng raw query để group by ngày.
   *
   * @param repository - Repository của entity cần thống kê
   * @returns Mảng điểm dữ liệu { date, count } đã được sắp xếp tăng dần theo ngày
   */
  private async getDailyGrowth<T extends { createdAt: Date }>(
    repository: Repository<T>,
  ): Promise<DailyGrowthPoint[]> {
    // Lấy tên bảng từ metadata của TypeORM
    const tableName = repository.metadata.tableName;

    // Lấy 30 ngày gần nhất
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Raw SQL query: group by ngày (DATE function của PostgreSQL)
    const rawResults: { date: string; count: string }[] =
      await repository.query(
        `SELECT DATE("createdAt") as date, COUNT(*) as count
         FROM "${tableName}"
         WHERE "createdAt" >= $1
         GROUP BY DATE("createdAt")
         ORDER BY date ASC`,
        [thirtyDaysAgo],
      );

    // Chuyển đổi count từ string sang number (PostgreSQL trả về string)
    return rawResults.map((row) => ({
      date: row.date,
      count: parseInt(row.count, 10),
    }));
  }
}
