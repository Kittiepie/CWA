import * as bcrypt from 'bcrypt';
import { PASSWORD_SALT_ROUNDS } from '../constants';

export const hashPasswordSync = (password: string): string => {
  return bcrypt.hashSync(password, PASSWORD_SALT_ROUNDS);
};

export const comparePasswordSync = (
  password: string,
  hash: string,
): boolean => {
  return bcrypt.compareSync(password, hash);
};

export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
};

export const comparePassword = async (
  password: string,
  hash: string,
): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};
