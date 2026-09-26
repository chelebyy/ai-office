import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const privateFiles =
  /^(?:\.claude\/|\.local\/|\.serena\/|\.playwright-mcp\/|assets\/|CODEBASE\.md$|design-review-|docs\/.*2026|docs\/CHELEBY_HOME_|docs\/README_DEVELOPMENT_HISTORY)/;
const credentialFiles = /(?:^|\/)(?:\.env(?:\..+)?|id_rsa|id_ed25519)$|\.(?:pem|p12|pfx|key)$/i;
const personalPath =
  /[A-Z]:[\\/]+(?:Users[\\/]+(?!<)[^\\/\s"'<>]+|All_Project[\\/])|\/home\/(?!<)[a-z0-9_.-]+\//i;
const credential =
  /gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-(?:proj-|ant-)?[A-Za-z0-9_-]{24,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;

/** Return categories only: never echo matched credentials or file contents. */
export function inspectFile(file, bytes) {
  const problems = [];
  if (privateFiles.test(file)) problems.push('private development artifact');
  if (credentialFiles.test(file) && !file.endsWith('.env.example'))
    problems.push('credential file');
  const content = bytes.toString('utf8');
  if (personalPath.test(content)) problems.push('personal absolute path');
  if (credential.test(content)) problems.push('possible credential');
  return problems;
}

export function checkRepository(root) {
  const files = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    {
      cwd: root,
      encoding: 'utf8',
    },
  )
    .split('\0')
    .filter(Boolean);
  const failures = [];
  for (const file of new Set(files)) {
    try {
      for (const problem of inspectFile(file, readFileSync(path.join(root, file))))
        failures.push(`${file}: ${problem}`);
    } catch {
      failures.push(`${file}: cannot read tracked file`);
    }
  }
  return { count: new Set(files).size, failures };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const { count, failures } = checkRepository(root);
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  } else console.log(`Repository hygiene passed (${count} files).`);
}
