import { UserDetails } from './dto/UserDetails';

export type AuthState = {
  userDetails: UserDetails | null;
  guestName: string | null;
  participantId: string | null;
  accessToken: string | null;
};
