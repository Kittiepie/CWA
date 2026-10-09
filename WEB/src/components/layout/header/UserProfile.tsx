"use client";

import React from "react";
import Link from "next/link";
import { useAppSelector } from "@/services/client/hooks";

export default function UserProfile() {
  const { authState } = useAppSelector((state) => state.auth);
  const user = authState?.userDetails;
  const isAdmin = user?.role === "admin";

  if (!user) {
    return (
      <div className="flex items-center space-x-3 ml-4">
        <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2.5 py-1 rounded-full">
          Khách vãng lai
        </span>
        <Link
          href="/auth/login"
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 transition"
        >
          Đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-3 ml-4">
      <div className="flex items-center space-x-2">
        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center font-bold text-xs">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm font-semibold text-gray-800">{user.name}</span>
      </div>

      {isAdmin && (
        <Link
          href="/admin"
          className="text-xs font-bold text-white bg-gradient-to-r from-red-600 to-indigo-600 hover:opacity-90 px-3 py-1.5 rounded-lg shadow-sm transition flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>Admin Panel</span>
        </Link>
      )}
    </div>
  );
}
