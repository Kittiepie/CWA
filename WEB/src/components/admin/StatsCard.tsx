import React from "react";

type StatsCardProps = {
  // Tiêu đề card (ví dụ: "Tổng Users")
  title: string;

  // Giá trị hiển thị chính (ví dụ: 1234)
  value: number | string;

  // Nhãn mô tả bên dưới giá trị (ví dụ: "người dùng")
  label: string;

  // Icon hiển thị bên phải card (JSX element)
  icon: React.ReactNode;

  // Màu accent của card (CSS class hoặc style)
  accentColor?: "blue" | "green" | "purple" | "orange";

  // Thay đổi so với hôm qua / tháng trước (optional)
  badge?: {
    value: string;
    type: "increase" | "neutral";
  };
};

/**
 * StatsCard - Card hiển thị một chỉ số thống kê.
 * Được dùng trong dashboard overview.
 */
export default function StatsCard({
  title,
  value,
  label,
  icon,
  accentColor = "blue",
  badge,
}: StatsCardProps) {
  return (
    <div className={`stats-card stats-card--${accentColor}`}>
      {/* Icon góc trên phải */}
      <div className="stats-card-icon">{icon}</div>

      {/* Nội dung chính */}
      <div className="stats-card-content">
        <p className="stats-card-title">{title}</p>

        <div className="stats-card-value-row">
          <span className="stats-card-value">
            {typeof value === "number" ? value.toLocaleString("vi-VN") : value}
          </span>

          {/* Badge hiển thị thay đổi (ví dụ: "+5 hôm nay") */}
          {badge && (
            <span className={`stats-card-badge stats-card-badge--${badge.type}`}>
              {badge.value}
            </span>
          )}
        </div>

        <p className="stats-card-label">{label}</p>
      </div>
    </div>
  );
}
