import crypto from 'crypto';

export const computeHash = (text: string): string => {
  return crypto.createHash('md5').update(text).digest('hex');
};
