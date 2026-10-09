import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiError } from 'src/common/lib/errors/ApiError';
import { AuthenticatedRequest } from 'src/common/interfaces/authenticated-request.interface';
import { ParticipantEntity } from 'src/room/entity/participant.entity';

/**
 * Lớp bảo mật thứ 2: Phân quyền vai trò Quản trị viên (Admin Role Guard).
 *
 * Yêu cầu:
 * - Phải chạy SAU JwtAuthGuard (Lớp bảo mật thứ 1 - đã xác thực danh tính và gán participantId).
 * - Kiểm tra người dùng liên kết với participant hiện tại có vai trò role === 'admin' hay không.
 * - Nếu không phải admin: Chặn ngay lập tức với mã lỗi 403 FORBIDDEN.
 */
@Injectable()
export class AdminRoleGuard implements CanActivate {
  constructor(
    @InjectRepository(ParticipantEntity)
    private readonly participantRepository: Repository<ParticipantEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const { participantId } = request;

    if (!participantId) {
      throw new ApiError(
        'Yêu cầu xác thực tài khoản quản trị viên',
        HttpStatus.UNAUTHORIZED,
        'ERR_AUTHENTICATION_REQUIRED',
      );
    }

    // Truy vấn participant kèm thông tin tài khoản user liên kết từ Database
    const participant = await this.participantRepository.findOne({
      where: { id: participantId },
      relations: { user: true },
    });

    // Nếu không tìm thấy thông tin user hoặc vai trò không phải 'admin' -> Chặn 403
    if (!participant?.user || participant.user.role !== 'admin') {
      throw new ApiError(
        'Bạn không có quyền quản trị viên để truy cập tính năng này',
        HttpStatus.FORBIDDEN,
        'ERR_FORBIDDEN',
      );
    }

    // Gán role vào request để các handler sau sử dụng nếu cần
    request.userRole = participant.user.role;

    return true;
  }
}
