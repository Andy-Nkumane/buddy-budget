import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import {
  checkAuthEmailTemplates,
  renderSyntheticTemplate,
  retrieveAuthEmailManifest,
  templateDirectory,
  validateAuthEmailTemplate,
} from './check-auth-email-templates.mjs';

test('all versioned templates satisfy their flow-specific variable contract', async () => {
  assert.equal(await checkAuthEmailTemplates(), 6);
});

test('templates render with synthetic values and no unresolved provider variables', async () => {
  const manifest = await retrieveAuthEmailManifest();
  for (const definition of manifest.templates) {
    const content = await readFile(join(templateDirectory, definition.file), 'utf8');
    const rendered = renderSyntheticTemplate(content, {
      ConfirmationURL:
        'https://synthetic.invalid/auth/v1/verify?token=REDACTED&redirect_to=https%3A%2F%2Fsynthetic.invalid',
      NewEmail: 'new.address+synthetic@example.invalid',
      Token: '123456',
    });
    assert.doesNotMatch(rendered, /\{\{\s*\./u, definition.type);
    assert.match(rendered, /Buddy Budget/iu, definition.type);
  }
});

test('validator rejects unsupported variables, tracking, and unsupported expiry claims', () => {
  const definition = { allowedVariables: ['ConfirmationURL'] };
  const errors = validateAuthEmailTemplate(
    definition,
    '<a href="{{ .ConfirmationURL }}">Continue</a>{{ .Data }}<img src="pixel">This link expires in 10 minutes.',
  );
  assert.ok(errors.some((error) => error.includes('unsupported variables')));
  assert.ok(errors.some((error) => error.includes('disable link tracking')));
  assert.ok(errors.some((error) => error.includes('tracking-capable')));
  assert.ok(errors.some((error) => error.includes('expiry')));
});

test('reauthentication uses only the provider-supported token value', async () => {
  const manifest = await retrieveAuthEmailManifest();
  const definition = manifest.templates.find(({ type }) => type === 'reauthentication');
  assert.deepEqual(definition.allowedVariables, ['Token']);
  assert.equal(definition.localConfig, false);
});

test('only the email-change template displays the supported new address value', async () => {
  const manifest = await retrieveAuthEmailManifest();
  const definitions = manifest.templates.filter(({ allowedVariables }) =>
    allowedVariables.includes('NewEmail'),
  );
  assert.deepEqual(
    definitions.map(({ type }) => type),
    ['email_change'],
  );
  const content = await readFile(join(templateDirectory, definitions[0].file), 'utf8');
  const rendered = renderSyntheticTemplate(content, {
    ConfirmationURL: 'https://synthetic.invalid/confirm',
    NewEmail: 'new.address+synthetic@example.invalid',
  });
  assert.match(rendered, /new\.address\+synthetic@example\.invalid/u);
});
