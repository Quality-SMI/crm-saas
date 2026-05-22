import { registerAs } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export default registerAs('jwt', () => {
  const privateKeyPath = path.resolve(
    process.env.JWT_PRIVATE_KEY_PATH || './keys/private.key',
  );
  const publicKeyPath = path.resolve(
    process.env.JWT_PUBLIC_KEY_PATH || './keys/public.key',
  );

  return {
    privateKey: fs.existsSync(privateKeyPath)
      ? fs.readFileSync(privateKeyPath, 'utf8')
      : process.env.JWT_PRIVATE_KEY,
    publicKey: fs.existsSync(publicKeyPath)
      ? fs.readFileSync(publicKeyPath, 'utf8')
      : process.env.JWT_PUBLIC_KEY,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  };
});
