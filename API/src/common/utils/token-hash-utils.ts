import * as bcrypt from 'bcrypt';
import { TOKEN_SALT_ROUNDS } from '../constants';

export const hashTokenSync = (token: string): string => {
  return bcrypt.hashSync(token, TOKEN_SALT_ROUNDS);
};

export const compareTokenSync = (token: string, hash: string): boolean => {
  return bcrypt.compareSync(token, hash);
};

export const hashToken = async (token: string): Promise<string> => {
  return await bcrypt.hash(token, TOKEN_SALT_ROUNDS);
};

export const compareToken = async (
  token: string,
  hash: string,
): Promise<boolean> => {
  return await bcrypt.compare(token, hash);
};
