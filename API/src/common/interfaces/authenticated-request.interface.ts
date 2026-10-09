import { Request } from 'express';
import { UserRole } from 'src/common/lib/types/dto/UserRoles';

// Interface mô tả request đã được xác thực bởi JwtAuthGuard
export interface AuthenticatedRequest extends Request {
  // ID của participant (cả guest lẫn user đã đăng ký)
  participantId: string;

  // Role của user (chỉ có khi participant liên kết với user account)
  userRole?: UserRole;
}
