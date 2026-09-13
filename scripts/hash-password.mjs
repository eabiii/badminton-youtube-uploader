import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readSync } from 'node:fs';

let password;
if (process.stdin.isTTY) {
  let echoDisabled = false;
  try {
    execFileSync('stty', ['-echo'], { stdio: ['inherit', 'ignore', 'inherit'] });
    echoDisabled = true;
    process.stderr.write('Shared password: ');
    const input = Buffer.alloc(1_002);
    const bytesRead = readSync(process.stdin.fd, input, 0, input.length, null);
    password = input.subarray(0, bytesRead).toString('utf8').replace(/[\r\n]+$/, '');
  } finally {
    if (echoDisabled) execFileSync('stty', ['echo'], { stdio: ['inherit', 'ignore', 'inherit'] });
    process.stderr.write('\n');
  }
} else {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  password = Buffer.concat(chunks).toString('utf8').replace(/[\r\n]+$/, '');
}
if (!password) {
  console.error('Provide the shared password on standard input.');
  process.exitCode = 1;
} else {
  const iterations = 600_000;
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  process.stdout.write(`pbkdf2-sha256:${iterations}:${salt.toString('base64')}:${hash.toString('base64')}\n`);
}
