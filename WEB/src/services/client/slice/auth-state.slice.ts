import { AuthState } from "@/lib/types/AuthState";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type AuthSliceState = {
  authState: AuthState | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const initialState: AuthSliceState = {
  authState: null,
  isLoading: false,
  isAuthenticated: false,
};

const authStateSlice = createSlice({
  name: "authState",
  initialState,
  reducers: {
    setIsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setIsAuthenticated: (state, action: PayloadAction<boolean>) => {
      state.isAuthenticated = action.payload;
    },
    setState: (state, action: PayloadAction<AuthState>) => {
      state.authState = action.payload;
      state.isAuthenticated = true;
    },
    clearState: (state) => {
      state.authState = null;
      state.isAuthenticated = false;
    }
  },
});

export default authStateSlice;
