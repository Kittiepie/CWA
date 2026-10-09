import { UserDetails } from './dto/UserDetails';

export type AuthState = {
  participantId: string | null;
  userDetails: UserDetails | null;
  guestName: string | null;
  accessToken: string | null;
};
