import { randomBytes, scryptSync } from 'node:crypto';
let input = '';
for await (const chunk of process.stdin) input += chunk;
const password = input.replace(/\r?\n$/, '');
if (password.length < 12 || password.length > 256) throw new Error('Use entre 12 e 256 caracteres.');
const salt = randomBytes(16).toString('hex');
console.log(`${salt}:${scryptSync(password, salt, 64).toString('hex')}`);
