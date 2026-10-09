"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCreateRoomMutation } from "@/services/client/slice/room.slice";
import parseApiErrorValue from "@/utils/parseErrorValues";
import { useAppSelector } from "@/services/client/hooks";

function getErrorMessage(error: unknown) {
  const errorValue = parseApiErrorValue(error);

  if (errorValue === "ERR_AUTHENTICATION_REQUIRED") {
    return "Your session has expired. Refresh the page and try again.";
  }

  return "Unable to create a room. Please try again.";
}

export default function CreateRoomCard() {
  const router = useRouter();
  // const authState = useAppSelector((state) => state.auth.authState);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const isAuthenticating = useAppSelector((state) => state.auth.isLoading);
  const [createRoom, { isLoading }] = useCreateRoomMutation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCreateRoom = async () => {
    setErrorMessage(null);

    try {
      const response = await createRoom().unwrap();

      if (!response.success) {
        setErrorMessage(response.message);
        return;
      }

      router.push(`/room/${encodeURIComponent(response.data.id)}`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  return (
    <section className="flex flex-col items-center gap-3">
      <button
        type="button"
        disabled={isAuthenticating || !isAuthenticated || isLoading}
        onClick={() => void handleCreateRoom()}
        className="group inline-flex items-center gap-2 rounded-full bg-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:-translate-y-0.5 hover:bg-indigo-500 hover:shadow-xl hover:shadow-indigo-500/40 disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-indigo-300 disabled:shadow-none"
      >
        {isAuthenticating
          ? "Preparing session..."
          : isLoading
            ? "Creating room..."
            : "Create a room"}
        <span
          aria-hidden
          className="transition-transform group-hover:translate-x-0.5"
        >
          →
        </span>
      </button>

      <p className="text-sm text-slate-500">
        No sign-up needed: you&apos;ll join with a guest name.
      </p>

      {errorMessage && (
        <p className="text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      )}
    </section>
  );
}
