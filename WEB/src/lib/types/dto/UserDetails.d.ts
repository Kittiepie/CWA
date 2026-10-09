import { UserRole } from './UserRoles';

export type UserDetails = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};
