// Must contain at least one lowercase letter, one uppercase letter, one number, and one special character
// No length check, since max and min length are defined separately in constants.ts
export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).*$/;
