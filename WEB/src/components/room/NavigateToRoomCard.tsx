import navigateToRoomAction from "@/services/server/navigateToRoomAction";

export default function NavigateToRoomCard() {
  return (
    <form
      action={navigateToRoomAction}
      className="rounded-lg border border-gray-200 bg-gray-50 p-6 shadow-sm"
    >
      <label htmlFor="room-id" className="mb-3 block text-sm font-medium text-gray-900">
        Enter a room ID to join
      </label>
      <div className="flex gap-2">
        <input
          id="room-id"
          name="id"
          type="text"
          required
          placeholder="Room ID"
          className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        {/*
          <input
            id="room-secret"
            name="secret"
            type="text"
            placeholder="Room Secret (optional)"
            className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        */}
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Join room
        </button>
      </div>
    </form>
  )
}

