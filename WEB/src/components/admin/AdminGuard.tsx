"use client";

import React from "react";
import Link from "next/link";
import { useAppSelector } from "@/services/client/hooks";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type AdminGuardProps = {
  children: React.ReactNode;
};

/**
 * AdminGuard - Bảo vệ khu vực Admin ở Frontend:
 * 1. Chờ nạp phiên xác thực (session) từ cookie.
 * 2. Nếu chưa đăng nhập: Điều hướng tới /auth/login.
 * 3. Nếu đã đăng nhập nhưng không phải role = 'admin': Hiển thị màn hình Từ chối truy cập (Access Denied).
 * 4. Nếu là Admin: Cho phép truy cập toàn bộ Bảng điều khiển.
 */
export default function AdminGuard({ children }: AdminGuardProps) {
  const router = useRouter();
  const { authState, isLoading } = useAppSelector((state) => state.auth);

  const role = authState?.userDetails?.role;
  const isAdmin = role === "admin";
  const isLoggedIn = !!authState?.userDetails;

  useEffect(() => {
    // Chỉ kiểm tra khi đã kết thúc quá trình nạp session
    if (isLoading) return;

    // Nếu chưa đăng nhập -> điều hướng tới trang login
    if (!isLoggedIn) {
      router.replace("/auth/login");
    }
  }, [isLoading, isLoggedIn, router]);

  // Đang tải phiên đăng nhập từ cookie / backend
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600 font-medium text-sm">Đang xác thực quyền Quản trị viên...</p>
      </div>
    );
  }

  // Chưa đăng nhập (đang chờ redirect)
  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <p className="text-gray-500 text-sm">Đang chuyển hướng đến trang đăng nhập...</p>
      </div>
    );
  }

  // Đã đăng nhập nhưng không phải quyền Admin (ví dụ: user thường hoặc guest)
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-red-200 shadow-sm text-center">
          <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Truy cập bị từ chối</h2>
          <p className="text-sm text-gray-600 mb-6">
            Tài khoản <span className="font-semibold text-gray-900">{authState?.userDetails?.name || authState?.userDetails?.email}</span> không có quyền Quản trị viên (Role: <span className="font-mono text-red-600">{role || "unknown"}</span>).
          </p>
          <Link
            href="/room"
            className="inline-flex items-center justify-center w-full px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition"
          >
            Quay về ứng dụng
          </Link>
        </div>
      </div>
    );
  }

  // Người dùng là Admin hợp lệ -> Render Bảng điều khiển
  return <>{children}</>;
}
