import { spawn } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('password hash CLI', () => {
  it('prompts securely when launched in a terminal', async () => {
    const password = 'correct horse battery staple';
    const result = await new Promise<{ code: number | null; output: string }>((resolve, reject) => {
      const child = spawn('script', ['-qfec', 'node scripts/hash-password.mjs', '/dev/null'], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let output = '';
      let answered = false;
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error(`Password prompt timed out. Output: ${output}`));
      }, 2_000);
      const capture = (chunk: Buffer) => {
        output += chunk.toString();
        if (!answered && output.includes('Shared password:')) {
          answered = true;
          child.stdin.write(`${password}\n`);
        }
      };
      child.stdout.on('data', capture);
      child.stderr.on('data', capture);
      child.on('error', reject);
      child.on('close', (code) => {
        clearTimeout(timeout);
        resolve({ code, output });
      });
    });

    expect(result.code, result.output).toBe(0);
    expect(result.output).toMatch(/pbkdf2-sha256:600000:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+/);
    expect(result.output).not.toContain(password);
    expect(result.output).not.toContain('Inappropriate ioctl for device');
  });
});
