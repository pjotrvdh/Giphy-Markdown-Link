import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const hookPath = join(rootDir, '.git/hooks/pre-commit');
const hook = `#!/bin/sh
set -e

npm run build
git add dist
`;

try {
  await mkdir(dirname(hookPath), { recursive: true });
  await writeFile(hookPath, hook);
  await chmod(hookPath, 0o755);
  console.log('Installed .git/hooks/pre-commit');
} catch (error) {
  if (error.code === 'ENOENT') {
    console.log('Skipped git hook installation: .git directory not found');
    process.exit(0);
  }

  throw error;
}
