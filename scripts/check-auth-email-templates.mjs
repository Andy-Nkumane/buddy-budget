import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
export const templateDirectory = join(root, 'supabase', 'templates', 'auth', 'v1');

export const retrieveAuthEmailManifest = async () =>
  JSON.parse(await readFile(join(templateDirectory, 'manifest.json'), 'utf8'));

export const findTemplateVariables = (content) =>
  [...content.matchAll(/\{\{\s*\.([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g)].map((match) => match[1]);

export const renderSyntheticTemplate = (content, values) =>
  content.replace(/\{\{\s*\.([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g, (_, variable) => {
    const value = values[variable];
    if (value === undefined) throw new Error(`Missing synthetic value for ${variable}`);
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  });

export const validateAuthEmailTemplate = (definition, content) => {
  const errors = [];
  const variables = findTemplateVariables(content);
  const unexpectedVariables = variables.filter(
    (variable) => !definition.allowedVariables.includes(variable),
  );
  if (unexpectedVariables.length)
    errors.push(`unsupported variables: ${[...new Set(unexpectedVariables)].join(', ')}`);
  for (const requiredVariable of definition.allowedVariables) {
    if (!variables.includes(requiredVariable)) errors.push(`missing variable: ${requiredVariable}`);
  }
  if (definition.allowedVariables.includes('ConfirmationURL')) {
    if (!/href="\{\{\s*\.ConfirmationURL\s*\}\}"/u.test(content))
      errors.push('ConfirmationURL must be the action href');
    if (!/href="\{\{\s*\.ConfirmationURL\s*\}\}"[^>]*\brel="notrack"/u.test(content))
      errors.push('authentication action must disable link tracking');
  }
  if (/<script\b|<img\b|tracking|analytics/iu.test(content))
    errors.push('tracking-capable or remote content is not allowed');
  if (/expires?\s+(?:in|after)|single[- ]use|one[- ]time link/iu.test(content))
    errors.push('unverified expiry or reuse claims are not allowed');
  return errors;
};

export const checkAuthEmailTemplates = async () => {
  const manifest = await retrieveAuthEmailManifest();
  const failures = [];
  for (const definition of manifest.templates) {
    const content = await readFile(join(templateDirectory, definition.file), 'utf8');
    const errors = validateAuthEmailTemplate(definition, content);
    if (errors.length) failures.push(`${definition.type}: ${errors.join('; ')}`);
  }
  if (failures.length) throw new Error(failures.join('\n'));
  return manifest.templates.length;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const count = await checkAuthEmailTemplates();
  console.log(`Validated ${count} versioned authentication email templates.`);
}
