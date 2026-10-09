import { redirect } from "next/navigation";

/**
 * Route /admin → tự động redirect sang /admin/dashboard
 */
export default function AdminPage() {
  redirect("/admin/dashboard");
}
