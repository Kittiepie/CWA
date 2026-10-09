"use client";

import React from "react";
import AuthLayout from "@/components/layout/AuthLayout";
import AdminGuard from "@/components/admin/AdminGuard";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { useAppSelector } from "@/services/client/hooks";
import "./admin.css";

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const authState = useAppSelector((state) => state.auth.authState);
  const adminName = authState?.userDetails?.name || "Quản trị viên";
  const adminEmail = authState?.userDetails?.email || "admin@system.local";

  return (
    <div className="admin-layout">
      {/* Sidebar bên trái */}
      <AdminSidebar />

      {/* Khu vực nội dung bên phải */}
      <div className="admin-main">
        {/* Header thanh điều hướng trên cùng */}
        <header className="admin-header">
          <div className="admin-breadcrumbs">
            <span>Bảng điều khiển</span>
            <span>/</span>
            <span className="active">Quản trị viên</span>
          </div>

          {/* Profile quản trị viên */}
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-semibold text-gray-900">{adminName}</span>
              <span className="text-xs text-indigo-600 font-mono font-medium">{adminEmail}</span>
            </div>

            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-indigo-100">
              {adminName.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Nội dung trang */}
        <main className="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthLayout>
      <AdminGuard>
        <AdminLayoutContent>{children}</AdminLayoutContent>
      </AdminGuard>
    </AuthLayout>
  );
}
