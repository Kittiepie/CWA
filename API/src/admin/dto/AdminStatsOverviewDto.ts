// DTO tổng quan hệ thống trả về cho admin
export interface AdminStatsOverviewDto {
  // Tổng số user đã đăng ký (có account)
  totalUsers: number;

  // Tổng số phòng whiteboard đã được tạo
  totalRooms: number;

  // Tổng số participants (bao gồm cả guest và user đã đăng ký)
  totalParticipants: number;

  // Số user mới đăng ký trong ngày hôm nay
  newUsersToday: number;

  // Số phòng được tạo trong ngày hôm nay
  newRoomsToday: number;
}
