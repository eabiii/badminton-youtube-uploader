import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const generatedLocalSecrets = resolve('dist/badminton_youtube_uploader/.dev.vars');
rmSync(generatedLocalSecrets, { force: true });
