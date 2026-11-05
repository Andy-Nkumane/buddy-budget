import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const containerName = 'supabase_auth_buddy-budget';
const backupName = `${containerName}-recovery-backup`;
const enabledFlags = new Map([
  ['GOTRUE_MFA_RECOVERY_CODES_ENROLL_ENABLED', 'true'],
  ['GOTRUE_MFA_RECOVERY_CODES_VERIFY_ENABLED', 'true'],
]);

const runDocker = (args, options = {}) =>
  execFileSync('docker', args, { encoding: 'utf8', stdio: options.quiet ? 'pipe' : 'inherit' });

const inspectContainer = (name) =>
  JSON.parse(execFileSync('docker', ['inspect', name], { encoding: 'utf8' }))[0];

const containerExists = (name) => {
  try {
    execFileSync('docker', ['inspect', name], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

const waitForHealthyContainer = (name) => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const status = execFileSync(
      'docker',
      ['inspect', '--format', '{{.State.Health.Status}}', name],
      { encoding: 'utf8' },
    ).trim();
    if (status === 'healthy') return;
    if (status === 'unhealthy') break;
    execFileSync('sleep', ['1']);
  }
  throw new Error('The replacement local Auth container did not become healthy.');
};

const restoreOriginalContainer = (networkName) => {
  try {
    runDocker(['rm', '--force', containerName], { quiet: true });
  } catch {
    // The replacement may not have been created.
  }
  runDocker(['rename', backupName, containerName], { quiet: true });
  try {
    runDocker(['network', 'connect', '--alias', 'auth', networkName, containerName], {
      quiet: true,
    });
  } catch {
    // A failed disconnect can leave the original attached to the correct network.
  }
  runDocker(['start', containerName], { quiet: true });
};

const configureLocalRecoveryCodes = () => {
  let inspected;
  try {
    inspected = inspectContainer(containerName);
  } catch {
    throw new Error('Start local Supabase before enabling MFA recovery codes.');
  }

  if (inspected.Config.Labels?.['com.supabase.cli.project'] !== 'buddy-budget')
    throw new Error('The local Auth container does not belong to the Buddy Budget project.');

  const environment = new Map(
    inspected.Config.Env.map((entry) => {
      const separator = entry.indexOf('=');
      return [entry.slice(0, separator), entry.slice(separator + 1)];
    }),
  );
  if ([...enabledFlags].every(([key, value]) => environment.get(key) === value)) {
    console.log('Local MFA recovery codes are already enabled.');
    return;
  }
  for (const [key, value] of enabledFlags) environment.set(key, value);

  const networkName = inspected.HostConfig.NetworkMode;
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'buddy-budget-auth-'));
  const environmentFile = join(temporaryDirectory, 'auth.env');
  writeFileSync(
    environmentFile,
    `${[...environment].map(([key, value]) => `${key}=${value}`).join('\n')}\n`,
    { mode: 0o600 },
  );
  chmodSync(environmentFile, 0o600);

  if (containerExists(backupName)) {
    rmSync(temporaryDirectory, { recursive: true, force: true });
    throw new Error(`Remove or restore the stale ${backupName} container before trying again.`);
  }

  let originalRenamed = false;
  try {
    runDocker(['stop', containerName], { quiet: true });
    runDocker(['rename', containerName, backupName], { quiet: true });
    originalRenamed = true;
    runDocker(['network', 'disconnect', networkName, backupName], { quiet: true });

    const createArguments = [
      'create',
      '--name',
      containerName,
      '--network',
      networkName,
      '--network-alias',
      'auth',
      '--restart',
      inspected.HostConfig.RestartPolicy.Name,
      '--user',
      inspected.Config.User,
      '--add-host',
      'host.docker.internal:host-gateway',
      '--env-file',
      environmentFile,
      '--health-cmd',
      inspected.Config.Healthcheck.Test.at(-1),
      '--health-interval',
      '10s',
      '--health-timeout',
      '2s',
      '--health-retries',
      '3',
    ];
    for (const [key, value] of Object.entries(inspected.Config.Labels ?? {}))
      createArguments.push('--label', `${key}=${value}`);
    createArguments.push(inspected.Config.Image, ...(inspected.Config.Cmd ?? []));

    runDocker(createArguments, { quiet: true });
    runDocker(['start', containerName], { quiet: true });
    waitForHealthyContainer(containerName);
    runDocker(['rm', backupName], { quiet: true });
    originalRenamed = false;
    console.log('Local MFA recovery-code enrollment and verification are enabled.');
  } catch (error) {
    if (originalRenamed) restoreOriginalContainer(networkName);
    throw error;
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
};

try {
  configureLocalRecoveryCodes();
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Local MFA recovery codes could not be enabled.',
  );
  process.exitCode = 1;
}
