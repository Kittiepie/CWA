import {
  Controller,
  DefaultValuePipe,
  Get,
  Inject,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { successResponse } from 'src/common/utils/api-response-utils';
import { ApiResponse } from 'src/common/lib/ApiResponse';
import { AdminRoleGuard } from './guard/admin-role.guard';
import {
  ADMIN_LIST_READER,
  ADMIN_STATS_READER,
} from './admin.contracts';
import type {
  AdminListReader,
  AdminStatsReader,
} from './admin.contracts';
import { AdminStatsOverviewDto } from './dto/AdminStatsOverviewDto';
import { AdminUserStatsDto } from './dto/AdminUserStatsDto';
import { AdminRoomStatsDto } from './dto/AdminRoomStatsDto';
import { UserDto } from 'src/user/entity/user.entity';
import { RoomDto } from 'src/room/entity/room.entity';

/**
 * Controller xử lý tất cả các endpoint trong khu vực admin.
 *
 * Bảo vệ 2 lớp:
 * 1. JwtAuthGuard: yêu cầu access token hợp lệ
 * 2. AdminRoleGuard: yêu cầu user phải có role = 'admin'
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminController {
  constructor(
    @Inject(ADMIN_STATS_READER)
    private readonly adminStatsReader: AdminStatsReader,

    @Inject(ADMIN_LIST_READER)
    private readonly adminListReader: AdminListReader,
  ) {}

  // ─────────────────────────────────────────────
  // THỐNG KÊ (Statistics)
  // ─────────────────────────────────────────────

  /**
   * GET /admin/stats/overview
   * Trả về số liệu tổng quan: tổng users, rooms, participants,
   * và số mới tạo trong ngày hôm nay.
   */
  @Get('stats/overview')
  async getStatsOverview(): Promise<ApiResponse<AdminStatsOverviewDto>> {
    const stats = await this.adminStatsReader.getStatsOverview();
    return successResponse('Lấy thống kê tổng quan thành công', stats);
  }

  /**
   * GET /admin/stats/users
   * Trả về thống kê users: phân bổ theo role và tăng trưởng 30 ngày.
   */
  @Get('stats/users')
  async getUserStats(): Promise<ApiResponse<AdminUserStatsDto>> {
    const stats = await this.adminStatsReader.getUserStats();
    return successResponse('Lấy thống kê users thành công', stats);
  }

  /**
   * GET /admin/stats/rooms
   * Trả về thống kê rooms: số phòng active và tăng trưởng 30 ngày.
   */
  @Get('stats/rooms')
  async getRoomStats(): Promise<ApiResponse<AdminRoomStatsDto>> {
    const stats = await this.adminStatsReader.getRoomStats();
    return successResponse('Lấy thống kê rooms thành công', stats);
  }

  // ─────────────────────────────────────────────
  // DANH SÁCH (List)
  // ─────────────────────────────────────────────

  /**
   * GET /admin/users?page=1&limit=20
   * Lấy danh sách tất cả users có phân trang.
   *
   * @param page  - Số trang (mặc định: 1)
   * @param limit - Số bản ghi mỗi trang (mặc định: 20)
   */
  @Get('users')
  async getAllUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<ApiResponse<{ items: UserDto[]; total: number }>> {
    const result = await this.adminListReader.getAllUsers(page, limit);
    return successResponse('Lấy danh sách users thành công', result);
  }

  /**
   * GET /admin/rooms?page=1&limit=20
   * Lấy danh sách tất cả rooms có phân trang.
   *
   * @param page  - Số trang (mặc định: 1)
   * @param limit - Số bản ghi mỗi trang (mặc định: 20)
   */
  @Get('rooms')
  async getAllRooms(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<ApiResponse<{ items: RoomDto[]; total: number }>> {
    const result = await this.adminListReader.getAllRooms(page, limit);
    return successResponse('Lấy danh sách rooms thành công', result);
  }
}
