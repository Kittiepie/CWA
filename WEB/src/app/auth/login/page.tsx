import { LoginForm } from "@/components/auth/login/LoginForm";

export default function LoginPage() {
  return (
    <div className="grow flex flex-col items-center justify-center">
      <div className="text-center border-2 border-black p-4 rounded-lg">
        <h1 className="text-3xl font-bold">Login</h1>
        <LoginForm />
      </div>
    </div>
  )
}
