import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const textExtensions = new Set(['.css', '.html', '.js', '.json', '.svg', '.webmanifest']);
const forbiddenPatterns = [
  ['service-role credential name', /(?:SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY)/],
  ['email-provider credential name', /(?:MAILJET_SECRET|SMTP_PASSWORD)/],
  ['database credential name', /(?:DATABASE_URL|DB_PASSWORD)/],
  ['GitHub job token name', /GITHUB_TOKEN/],
  ['Supabase secret-key format', /sb_secret_[A-Za-z0-9_-]+/],
  ['private-key material', /BEGIN (?:RSA |EC )?PRIVATE KEY/],
];

const listFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(path);
    return textExtensions.has(extname(entry.name)) ? [path] : [];
  });

export const findArtifactBoundaryFindings = (repositoryRoot) => {
  const artifactRoot = join(repositoryRoot, 'dist');
  if (!statSync(artifactRoot, { throwIfNoEntry: false })?.isDirectory())
    return ['dist: production build artifact is missing'];
  return listFiles(artifactRoot).flatMap((path) => {
    const content = readFileSync(path, 'utf8');
    return forbiddenPatterns
      .filter(([, pattern]) => pattern.test(content))
      .map(
        ([label]) => `${relative(repositoryRoot, path).replaceAll('\\', '/')}: contains ${label}`,
      );
  });
};

const scriptPath = fileURLToPath(import.meta.url);
if (resolve(process.argv[1] ?? '') === scriptPath) {
  const repositoryRoot = resolve(dirname(scriptPath), '..');
  const findings = findArtifactBoundaryFindings(repositoryRoot);
  if (findings.length > 0) {
    console.error(findings.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Public build credential-boundary scan passed.');
  }
}
