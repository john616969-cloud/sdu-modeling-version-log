import { pbkdf2Sync, randomBytes } from 'node:crypto';

const password = process.argv[2];
if (!password || password.length < 8) {
  console.error('用法：node scripts/generate-password-hash.mjs "至少8位的团队密码"');
  process.exit(1);
}
const iterations = 210000;
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
const encode = (buffer) => buffer.toString('base64url');
console.log(`pbkdf2$${iterations}$${encode(salt)}$${encode(hash)}`);
