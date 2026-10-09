import AuthLayout from "@/components/layout/AuthLayout";
import Header from "@/components/layout/header/Header";

export default function AuthenticatedLayout({ children }: LayoutProps<"/">) {
  return (
    <AuthLayout>
      {/* Pinned to the viewport so a full-height page (the board) fills what's
          left under the header instead of adding its own height below it. */}
      <div className="flex h-dvh flex-col">
        <div className="shrink-0">
          <Header />
        </div>
        <div className="min-h-0 grow overflow-auto">{children}</div>
      </div>
    </AuthLayout>
  );
}
