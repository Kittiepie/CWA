/** The API wraps every body as `{ success, message, data | error }`. */
interface Envelope<T> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

async function request<T>(
  method: "GET" | "POST",
  url: string,
  token?: string,
): Promise<T> {
  let response: Awaited<ReturnType<typeof fetch>>;
  try {
    response = await fetch(url, {
      method,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch (error) {
    // fetch itself only says "fetch failed"; name the server that couldn't be reached.
    const cause = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not reach ${url}. Is the API running? (${cause})`);
  }

  let body: Envelope<T> | null = null;
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    // Not JSON: fall through and report the HTTP status instead.
  }

  if (!response.ok || !body?.success || body.data === undefined) {
    const reason = body?.error ?? body?.message ?? response.statusText;
    throw new Error(`${method} ${url} failed (${response.status} ${reason})`);
  }
  return body.data;
}

export interface Guest {
  participantId: string;
  accessToken: string;
}

/**
 * A first visit with no refresh cookie: the API mints a new guest participant
 * (random name) and hands back an access token, just as it does for a browser.
 */
export async function createGuest(api: string): Promise<Guest> {
  const data = await request<Guest>("GET", `${api}/auth/refresh`);
  return { participantId: data.participantId, accessToken: data.accessToken };
}

export async function createRoom(api: string, token: string): Promise<string> {
  const room = await request<{ id: string }>(
    "POST",
    `${api}/room/new-room`,
    token,
  );
  return room.id;
}

/**
 * Loads the room into Redis if nobody has yet, and writes this guest's
 * participant hash (display name and theme). The HTTP3 server reads that hash
 * to attribute chat, so bots must join through here like real users.
 */
export async function joinRoom(
  api: string,
  token: string,
  roomId: string,
): Promise<void> {
  await request<unknown>(
    "GET",
    `${api}/room/${encodeURIComponent(roomId)}`,
    token,
  );
}
