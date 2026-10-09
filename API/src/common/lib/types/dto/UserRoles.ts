export const AllUserRoles = ['admin', 'user', 'guest'] as const;

export type UserRole = (typeof AllUserRoles)[number];
