import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import {
  findForbiddenClientVariables,
  findTrackedEnvironmentFiles,
} from './check-compliance-boundaries.mjs';

const temporaryDirectories = [];

const createRepository = (source) => {
  const root = mkdtempSync(join(tmpdir(), 'buddy-budget-compliance-'));
  temporaryDirectories.push(root);
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'example.ts'), source);
  return root;
};

afterEach(() => {
  temporaryDirectories.splice(0).forEach((path) => rmSync(path, { recursive: true }));
});

test('COMP-017 permits the documented public browser variables', () => {
  const root = createRepository(
    'const url = import.meta.env.VITE_SUPABASE_URL; const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;',
  );
  assert.deepEqual(findForbiddenClientVariables(root), []);
});

test('COMP-017 rejects server-only credential names in browser code', () => {
  const root = createRepository('const key = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;');
  assert.deepEqual(findForbiddenClientVariables(root), [
    {
      file: 'src/example.ts',
      variable: 'VITE_SUPABASE_SERVICE_ROLE_KEY',
    },
  ]);
});

test('COMP-017 rejects destructured server-only credential names', () => {
  const root = createRepository('const { VITE_MAILJET_SECRET_KEY } = import.meta.env;');
  assert.deepEqual(findForbiddenClientVariables(root), [
    {
      file: 'src/example.ts',
      variable: 'VITE_MAILJET_SECRET_KEY',
    },
  ]);
});

test('COMP-017 rejects tracked environment files but permits the example contract', () => {
  assert.deepEqual(findTrackedEnvironmentFiles(['.env.example', '.env.production']), [
    '.env.production',
  ]);
});
