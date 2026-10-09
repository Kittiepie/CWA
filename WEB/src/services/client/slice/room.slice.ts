import { ApiResponse } from "@/lib/ApiResponse";
import { apiClient } from "./api-client";
import { RoomDto } from "@/types/dto/RoomDto";
import { ROOM_URL } from "../constants";

export const roomApiSlice = apiClient.injectEndpoints({
  endpoints: (builder) => ({
    createRoom: builder.mutation<ApiResponse<RoomDto>, void>({
      query: () => ({
        url: `${ROOM_URL}/new-room`,
        method: "POST",
      }),
      invalidatesTags: ["Room"],
    }),

    joinRoom: builder.mutation<ApiResponse<RoomDto>, string>({
      query: (roomId) => ({
        url: `${ROOM_URL}/${encodeURIComponent(roomId)}`,
        method: "GET",
      }),
      invalidatesTags: (_result, _error, roomId) => [
        { type: "Room", id: roomId },
      ],
    }),

    uploadBoardImage: builder.mutation<
      ApiResponse<{ id: string }>,
      { roomId: string; file: File }
    >({
      query: ({ roomId, file }) => {
        const body = new FormData();
        body.append("file", file);
        return {
          url: `${ROOM_URL}/${encodeURIComponent(roomId)}/images`,
          method: "POST",
          body,
        };
      },
    }),
  }),
});

export const {
  useCreateRoomMutation,
  useJoinRoomMutation,
  useUploadBoardImageMutation,
} = roomApiSlice;
