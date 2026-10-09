"use client";

import { useAppDispatch } from "@/services/client/hooks";
import authStateSlice from "@/services/client/slice/auth-state.slice";
import { useRefreshSessionQuery } from "@/services/client/slice/auth.slice";
import { useEffect } from "react";

export type AuthLayoutProps = {
  children: React.ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  const { setIsLoading, setState, clearState } = authStateSlice.actions;
  const {
    data: refreshSessionResponse,
    isLoading,
    isFetching,
  } = useRefreshSessionQuery();
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setIsLoading(isLoading || isFetching));

    if (refreshSessionResponse?.success) {
      dispatch(setState(refreshSessionResponse.data));
      return;
    }

    if (refreshSessionResponse && !refreshSessionResponse.success) {
      dispatch(clearState());
    }
  }, [
    refreshSessionResponse,
    clearState,
    dispatch,
    setState,
    isLoading,
    isFetching,
    setIsLoading
  ]);

  return (
    <>{children}</>
  )
}

