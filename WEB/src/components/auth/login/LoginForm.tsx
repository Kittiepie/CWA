"use client"

import { useLoginMutation } from "@/services/client/slice/auth.slice"
import parseApiErrorValue from "@/utils/parseErrorValues"
import { useRouter } from "next/navigation"
import { SubmitHandler, useForm } from "react-hook-form"
import { toast } from "react-toastify"

export type LoginFormInputs = {
  loginKey: string
  password: string
}

export const LoginForm = () => {
  const {
    register,
    handleSubmit,
    // watch,
    trigger,
    formState: { errors },
  } = useForm<LoginFormInputs>()
  const router = useRouter();

  const [login] = useLoginMutation();

  const onSubmit: SubmitHandler<LoginFormInputs> = async (data) => {
    try {
      const reduxResponse = await login(data);
      const { data: response } = reduxResponse;
      if (response?.success) {
        toast.success(`Login successful as ${response.data.name}`);
        if (response.data.role === "admin") {
          router.push("/admin");
        } else {
          router.push("/room");
        }
      }
      else {
        const errorValue = parseApiErrorValue(reduxResponse.error);
        if (errorValue) {
          switch (errorValue) {
            case "ERR_INVALID_CREDENTIALS":
              toast.error("Invalid credentials");
              break;
            case "ERR_USER_NOT_FOUND":
              toast.error("User not found");
              break;
            case "ERR_INVALID_PASSWORD":
              toast.error("Invalid password");
              break;
            case "ERR_VALIDATION_FAILED":
              toast.error("Invalid login key or password");
              break;
            default:
              toast.error("Unknown error");
              break;
          }
        }
        else {
          toast.error("Unknown error");
        }
      }
    }
    catch (error) {
      console.error(error);
      toast.error("Unknown error");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label htmlFor="loginKey">Login Key</label>
        <input {...register("loginKey", {
          required: true,
          minLength: 1,
          maxLength: 30,
          onChange: () => { trigger("loginKey") }
        })} />
        <label htmlFor="password">Password</label>
        <input {...register("password", {
          required: true,
          minLength: 1,
          maxLength: 30,
          onChange: () => { trigger("password") },
        })} type="password" />
        <input type="submit" value="Submit" />
      </div>
    </form >
  )
}
