import { afterAll, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
// `bun test` runs the TypeScript sources with Bun; `bun run test:node` runs the built bundle with Node.
const RUNTIME = process.env.CGLG_TEST_RUNTIME === 'node'
  ? ['node', join(ROOT, 'out/bin.js')]
  : [process.execPath, join(ROOT, 'src/cli.ts')];

const ENV: NodeJS.ProcessEnv = {
  PATH: process.env.PATH,
  HOME: tmpdir(),
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
  NO_COLOR: '1'
};

const dirs: string[] = [];
afterAll(() => dirs.forEach(dir => rmSync(dir, { recursive: true, force: true })));

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd, env: ENV, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function gitOk(cwd: string, ...args: string[]): boolean {
  return spawnSync('git', args, { cwd, env: ENV }).status === 0;
}

interface Run {
  code: number | null;
  out: string;
  all: string;
}

function cglg(cwd: string, ...args: string[]): Run {
  const result = spawnSync(RUNTIME[0], [...RUNTIME.slice(1), ...args], { cwd, env: ENV, encoding: 'utf8' });
  return { code: result.status, out: result.stdout, all: result.stdout + result.stderr };
}

function expectOk(run: Run): Run {
  if (run.code !== 0) throw new Error(`expected exit 0, got ${run.code}:\n${run.all}`);
  return run;
}

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

interface RepoOptions {
  main?: string;
  develop?: boolean;
  config?: Record<string, unknown>;
}

function setupRepo({ main = 'master', develop = true, config }: RepoOptions = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cglg-'));
  dirs.push(root);
  const remote = join(root, 'remote.git');
  const work = join(root, 'work');
  git(root, 'init', '-q', '--bare', '-b', main, remote);
  git(root, 'init', '-q', '-b', main, work);
  git(work, 'remote', 'add', 'origin', remote);
  writeFileSync(join(work, 'package.json'), '{\n  "name": "demo",\n  "version": "1.0.0"\n}\n');
  writeFileSync(join(work, 'changelog.json'), `${JSON.stringify({
    title: 'Changelog',
    description: 'Demo',
    ...(config ? { config } : {}),
    changes: [{ version: '1.0.0', date: '2026-01-01', items: [{ type: 'added', value: 'First release' }] }]
  }, null, 2)}\n`);
  writeFileSync(join(work, 'app.txt'), 'v1\n');
  git(work, 'add', '-A');
  git(work, 'commit', '-qm', 'initial');
  git(work, 'tag', 'v1.0.0');
  git(work, 'push', '-q', '-u', 'origin', main, '--tags');
  if (develop) {
    git(work, 'checkout', '-qb', 'develop');
    git(work, 'push', '-q', '-u', 'origin', 'develop');
  }

  const commit = (file: string, contents: string, message: string): void => {
    writeFileSync(join(work, file), contents);
    git(work, 'add', '-A');
    git(work, 'commit', '-qm', message);
  };
  const branch = (): string => git(work, 'branch', '--show-current');
  const remoteRef = (ref: string): string => git(remote, 'rev-parse', '--verify', '--quiet', ref);
  const remoteHas = (ref: string): boolean => gitOk(remote, 'rev-parse', '--verify', '--quiet', ref);
  return { root, work, remote, commit, branch, remoteRef, remoteHas, json: (file: string) => readJson(join(work, file)) };
}

describe('GitFlow (develop + master)', () => {
  const repo = setupRepo();

  test('feature start creates the branch from develop', () => {
    const run = expectOk(cglg(repo.work, 'feature', 'start', 'Login form'));
    expect(run.out).toContain('Started feature/login-form from develop');
    expect(repo.branch()).toBe('feature/login-form');
  });

  test('feature finish asks the agent for entries, then for approval', () => {
    repo.commit('login.txt', 'form\n', 'feat: add login form');

    const missing = cglg(repo.work, 'feature', 'finish');
    expect(missing.code).toBe(2);
    expect(missing.out).toContain('ACTION REQUIRED');
    expect(missing.out).toContain('feat: add login form  [suggested: added]');
    expect(missing.out).toContain('--skip-entries');

    const unapproved = cglg(repo.work, 'feature', 'finish', '--entry', 'added: Login form');
    expect(unapproved.code).toBe(2);
    expect(unapproved.out).toContain('The user must approve');
    expect(unapproved.out).toContain('added: Login form');
    expect(unapproved.out).toContain("cglg feature finish --entry 'added: Login form' --approved");
    expect(repo.branch()).toBe('feature/login-form');
  });

  test('feature finish merges, stashes the entry and pushes develop', () => {
    expectOk(cglg(repo.work, 'feature', 'finish', '--entry', 'added: Login form', '--approved'));
    expect(repo.branch()).toBe('develop');
    expect(gitOk(repo.work, 'rev-parse', '--verify', '--quiet', 'feature/login-form')).toBe(false);
    expect(repo.json('changelog.json').temp).toEqual([{ type: 'added', value: 'Login form' }]);
    expect(repo.remoteRef('develop')).toBe(git(repo.work, 'rev-parse', 'develop'));
  });

  test('release start explains what is missing', () => {
    repo.commit('app.txt', 'v2\n', 'fix: crash on empty input');
    const run = cglg(repo.work, 'release', 'start');
    expect(run.code).toBe(2);
    expect(run.out).toContain('Choose the version bump and write the changelog entries');
    expect(run.out).toContain('Commits since v1.0.0');
    expect(run.out).toContain('fix: crash on empty input  [suggested: fixed]');
    expect(run.out).toContain('Stashed entries (already included)');
    expect(run.out).toContain('Suggested: minor → 1.1.0');
    // The tool's own commits are not listed.
    expect(run.out).not.toContain('chore(changelog)');
  });

  test('release start bumps, writes the changelog and opens the release branch', () => {
    const run = expectOk(cglg(repo.work, 'release', 'start', 'minor', '--entry', 'fixed: Crash on empty input', '--approved'));
    expect(run.out).toContain('Release 1.1.0 started on release/1.1.0');
    expect(repo.branch()).toBe('release/1.1.0');
    expect(repo.json('package.json').version).toBe('1.1.0');
    const data = repo.json('changelog.json');
    expect(data.temp).toEqual([]);
    expect(data.changes[0].version).toBe('1.1.0');
    expect(data.changes[0].items).toEqual([
      { type: 'added', value: 'Login form' },
      { type: 'fixed', value: 'Crash on empty input' }
    ]);
    const md = readFileSync(join(repo.work, 'CHANGELOG.md'), 'utf8');
    expect(md).toContain('## [1.1.0]');
    expect(md).toContain('### Fixed\n- Crash on empty input.');
    expect(git(repo.work, 'log', '-1', '--format=%s')).toBe('Version 1.1.0');
    expect(git(repo.work, 'status', '--porcelain')).toBe('');
    expect(repo.remoteHas('release/1.1.0')).toBe(true);
  });

  test('release finish merges into master and develop, tags, deletes and pushes', () => {
    const run = expectOk(cglg(repo.work, 'release', 'finish'));
    expect(run.out).toContain('Release 1.1.0 finished');
    expect(repo.branch()).toBe('develop');
    expect(gitOk(repo.work, 'merge-base', '--is-ancestor', 'v1.1.0', 'master')).toBe(true);
    expect(gitOk(repo.work, 'merge-base', '--is-ancestor', 'v1.1.0', 'develop')).toBe(true);
    expect(gitOk(repo.work, 'rev-parse', '--verify', '--quiet', 'release/1.1.0')).toBe(false);
    expect(repo.remoteHas('release/1.1.0')).toBe(false);
    expect(repo.remoteHas('refs/tags/v1.1.0')).toBe(true);
    expect(repo.remoteRef('master')).toBe(git(repo.work, 'rev-parse', 'master'));
    expect(repo.remoteRef('develop')).toBe(git(repo.work, 'rev-parse', 'develop'));
  });

  test('status --json reports the new state', () => {
    const status = JSON.parse(expectOk(cglg(repo.work, 'status', '--json')).out);
    expect(status.status).toBe('ok');
    expect(status.data).toMatchObject({ version: '1.1.0', lastRelease: 'v1.1.0', branch: 'develop', branchKind: 'develop', commits: [] });
  });
});

describe('Trunk with release branches (main only)', () => {
  const repo = setupRepo({ main: 'main', develop: false });

  test('features branch from main and the release merges back into main', () => {
    expectOk(cglg(repo.work, 'feature', 'start', 'dark-mode'));
    repo.commit('theme.txt', 'dark\n', 'Add dark mode');
    // release start on a feature branch merges the feature first
    expectOk(cglg(repo.work, 'release', 'start', 'minor', '--entry', 'added: Dark mode', '--approved'));
    expect(repo.branch()).toBe('release/1.1.0');
    expect(gitOk(repo.work, 'rev-parse', '--verify', '--quiet', 'feature/dark-mode')).toBe(false);

    expectOk(cglg(repo.work, 'release', 'finish'));
    expect(repo.branch()).toBe('main');
    expect(git(repo.work, 'rev-parse', 'v1.1.0^{commit}')).toBe(git(repo.work, 'rev-parse', 'main'));
    expect(repo.remoteRef('main')).toBe(git(repo.work, 'rev-parse', 'main'));
    expect(repo.json('package.json').version).toBe('1.1.0');
  });
});

describe('Trunk releasing directly, no approval required', () => {
  const repo = setupRepo({ main: 'main', develop: false, config: { releaseBranches: false, agent: { confirmChangelog: false } } });

  test('release start commits, tags and pushes in one go', () => {
    repo.commit('app.txt', 'v2\n', 'feat: export to csv');
    const run = expectOk(cglg(repo.work, 'release', 'start', 'minor', '--entry', 'added: CSV export'));
    expect(run.out).toContain('Released 1.1.0');
    expect(repo.branch()).toBe('main');
    expect(git(repo.work, 'rev-parse', 'v1.1.0^{commit}')).toBe(git(repo.work, 'rev-parse', 'HEAD'));
    expect(repo.remoteHas('refs/tags/v1.1.0')).toBe(true);
    expect(repo.remoteRef('main')).toBe(git(repo.work, 'rev-parse', 'main'));
  });

  test('--no-push keeps everything local and prints the push command', () => {
    repo.commit('app.txt', 'v3\n', 'fix: rounding');
    const before = repo.remoteRef('main');
    const run = expectOk(cglg(repo.work, 'release', 'start', 'patch', '--entry', 'fixed: Rounding', '--no-push'));
    expect(run.out).toContain('Not pushed. To push later: git push --atomic origin main v1.1.1');
    expect(repo.remoteRef('main')).toBe(before);
  });
});

describe('GitFlow releasing directly (no release branches)', () => {
  const repo = setupRepo({ config: { releaseBranches: false } });

  test('develop is merged into master and tagged', () => {
    repo.commit('app.txt', 'v2\n', 'fix: typo');
    expectOk(cglg(repo.work, 'release', 'start', 'patch', '--entry', 'fixed: Typo', '--approved'));
    expect(repo.branch()).toBe('develop');
    expect(git(repo.work, 'rev-parse', 'v1.0.1^{commit}')).toBe(git(repo.work, 'rev-parse', 'master'));
    expect(repo.remoteRef('master')).toBe(git(repo.work, 'rev-parse', 'master'));
    expect(repo.remoteRef('develop')).toBe(git(repo.work, 'rev-parse', 'develop'));
  });
});

describe('Safety', () => {
  test('uncommitted changes stop the command until committed', () => {
    const repo = setupRepo();
    writeFileSync(join(repo.work, 'wip.txt'), 'wip\n');
    const blocked = cglg(repo.work, 'release', 'start', 'patch', '--entry', 'fixed: X', '--approved');
    expect(blocked.code).toBe(2);
    expect(blocked.out).toContain('uncommitted changes');
    expect(blocked.out).toContain('wip.txt');

    expectOk(cglg(repo.work, 'release', 'start', 'patch', '--entry', 'fixed: X', '--approved', '--message', 'chore: add wip'));
    expect(git(repo.work, 'log', '--format=%s', '-2')).toBe('Version 1.0.1\nchore: add wip');
  });

  test('--dry-run changes nothing', () => {
    const repo = setupRepo();
    repo.commit('app.txt', 'v2\n', 'feat: x');
    const head = git(repo.work, 'rev-parse', 'HEAD');
    const run = expectOk(cglg(repo.work, 'release', 'start', 'minor', '--entry', 'added: X', '--dry-run'));
    expect(run.all).toContain('[dry-run] $ git checkout --quiet -b release/1.1.0');
    expect(repo.branch()).toBe('develop');
    expect(git(repo.work, 'rev-parse', 'HEAD')).toBe(head);
    expect(repo.json('package.json').version).toBe('1.0.0');
    expect(run.all).not.toContain('Pushed:');
  });

  test('a conflicting feature is not merged and you stay on it', () => {
    const repo = setupRepo();
    expectOk(cglg(repo.work, 'feature', 'start', 'conflict'));
    repo.commit('app.txt', 'feature\n', 'feat: change app');
    git(repo.work, 'checkout', '-q', 'develop');
    repo.commit('app.txt', 'develop\n', 'fix: change app');
    git(repo.work, 'checkout', '-q', 'feature/conflict');

    const run = cglg(repo.work, 'feature', 'finish', '--skip-entries');
    expect(run.code).toBe(1);
    expect(run.all).toContain('Merging feature/conflict into develop failed');
    expect(run.all).toContain('git merge develop');
    expect(repo.branch()).toBe('feature/conflict');
    expect(git(repo.work, 'status', '--porcelain')).toBe('');
  });

  test('release finish detects conflicts before changing anything, and resumes', () => {
    const repo = setupRepo();
    expectOk(cglg(repo.work, 'release', 'start', 'patch', '--entry', 'fixed: X', '--approved'));
    repo.commit('app.txt', 'release fix\n', 'fix: on release');
    git(repo.work, 'checkout', '-q', 'develop');
    repo.commit('app.txt', 'new develop work\n', 'feat: on develop');
    git(repo.work, 'checkout', '-q', 'release/1.0.1');
    const master = git(repo.work, 'rev-parse', 'master');

    const run = cglg(repo.work, 'release', 'finish');
    expect(run.code).toBe(1);
    expect(run.all).toContain('would conflict in: app.txt');
    expect(git(repo.work, 'rev-parse', 'master')).toBe(master);
    expect(repo.branch()).toBe('release/1.0.1');

    // Resolve on develop by hand, then finish again: the develop merge is skipped.
    git(repo.work, 'checkout', '-q', 'develop');
    spawnSync('git', ['merge', 'release/1.0.1'], { cwd: repo.work, env: ENV });
    writeFileSync(join(repo.work, 'app.txt'), 'resolved\n');
    git(repo.work, 'commit', '-qam', 'Merge release/1.0.1 into develop');
    const resumed = expectOk(cglg(repo.work, 'release', 'finish'));
    expect(resumed.out).toContain('already merged into develop');
    expect(gitOk(repo.work, 'merge-base', '--is-ancestor', 'v1.0.1', 'master')).toBe(true);
  });

  test('an existing tag blocks the release up front', () => {
    const repo = setupRepo({ main: 'main', develop: false });
    git(repo.work, 'tag', 'v1.0.1');
    const run = cglg(repo.work, 'release', 'start', 'patch', '--entry', 'fixed: X', '--approved');
    expect(run.code).toBe(1);
    expect(run.all).toContain('Tag v1.0.1 already exists');
    expect(repo.branch()).toBe('main');
  });

  test('releases start from develop in GitFlow, not from master', () => {
    const repo = setupRepo();
    git(repo.work, 'checkout', '-q', 'master');
    const run = cglg(repo.work, 'release', 'start', 'patch', '--entry', 'fixed: X', '--approved');
    expect(run.code).toBe(1);
    expect(run.all).toContain('releases start from develop');
  });
});

describe('Line endings', () => {
  const crlf = (text: string): string => text.replace(/\n/g, '\r\n');
  const isCrlf = (text: string): boolean => text.includes('\r\n') && !/[^\r]\n/.test(text);

  test('a CRLF project stays CRLF, and a release only diffs the changed lines', () => {
    const repo = setupRepo({ main: 'main', develop: false });
    // Rewrite the tracked files with Windows line endings, as a Windows checkout without autocrlf would have them.
    for (const file of ['package.json', 'changelog.json'])
      writeFileSync(join(repo.work, file), crlf(readFileSync(join(repo.work, file), 'utf8').replace(/\r\n/g, '\n')));
    const lock = { name: 'demo', version: '1.0.0', lockfileVersion: 3, packages: { '': { name: 'demo', version: '1.0.0' } } };
    writeFileSync(join(repo.work, 'package-lock.json'), crlf(`${JSON.stringify(lock, null, 2)}\n`));
    git(repo.work, 'add', '-A');
    git(repo.work, 'commit', '-qm', 'chore: windows line endings');

    expectOk(cglg(repo.work, 'add', '--fixed', 'Stashed fix', '--approved'));
    expectOk(cglg(repo.work, 'release', 'start', 'minor', '--entry', 'added: Multi\nline entry', '--approved'));

    for (const file of ['package.json', 'package-lock.json', 'changelog.json', 'CHANGELOG.md'])
      expect(isCrlf(readFileSync(join(repo.work, file), 'utf8'))).toBe(true);

    // package.json: only the version line changed; package-lock.json: the two version lines.
    const numstat = (file: string): string => git(repo.work, 'diff', '--numstat', 'HEAD~1', 'HEAD', '--', file).split('\t').slice(0, 2).join(' ');
    expect(numstat('package.json')).toBe('1 1');
    expect(numstat('package-lock.json')).toBe('2 2');
    expect(repo.json('changelog.json').changes[0].version).toBe('1.1.0');
  });

  test('LF files stay LF, and new files follow the project', () => {
    const repo = setupRepo({ main: 'main', develop: false });
    expectOk(cglg(repo.work, 'release', 'start', 'patch', '--entry', 'fixed: X', '--approved'));
    for (const file of ['package.json', 'changelog.json', 'CHANGELOG.md'])
      expect(readFileSync(join(repo.work, file), 'utf8')).not.toContain('\r');

    const dir = mkdtempSync(join(tmpdir(), 'cglg-'));
    dirs.push(dir);
    writeFileSync(join(dir, 'package.json'), '{\r\n  "name": "x",\r\n  "version": "1.0.0"\r\n}\r\n');
    expectOk(cglg(dir, 'release', 'start', 'patch', '--entry', 'fixed: X', '--sg', '--approved'));
    for (const file of ['changelog.json', 'CHANGELOG.md'])
      expect(isCrlf(readFileSync(join(dir, file), 'utf8'))).toBe(true);
  });
});

describe('Other modes', () => {
  test('--sg works without git and without package.json', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cglg-'));
    dirs.push(dir);
    expectOk(cglg(dir, 'release', 'start', 'minor', '--entry', 'added: Something', '--sg', '--approved'));
    const data = readJson(join(dir, 'changelog.json'));
    expect(data.changes[0]).toMatchObject({ version: '0.1.0', items: [{ type: 'added', value: 'Something' }] });
    expect(existsSync(join(dir, 'CHANGELOG.md'))).toBe(true);
    // Version is read back from changelog.json next time.
    expectOk(cglg(dir, 'release', 'start', 'patch', '--fixed', 'Bug', '--sg', '--approved'));
    expect(readJson(join(dir, 'changelog.json')).changes[0].version).toBe('0.1.1');
  });

  test('legacy --action flags still work', () => {
    const repo = setupRepo({ main: 'main', develop: false });
    expectOk(cglg(repo.work, '--action=newRelease', '--p', '--entry', 'fixed: X', '--approved'));
    expect(repo.branch()).toBe('release/1.0.1');
    expectOk(cglg(repo.work, '--action=closeRelease', '--noTag'));
    expect(gitOk(repo.work, 'rev-parse', '--verify', '--quiet', 'v1.0.1')).toBe(false);
    expect(repo.branch()).toBe('main');
  });

  test('package-lock.json is bumped together with package.json', () => {
    const repo = setupRepo({ main: 'main', develop: false });
    const lock = { name: 'demo', version: '1.0.0', lockfileVersion: 3, packages: { '': { name: 'demo', version: '1.0.0' } } };
    repo.commit('package-lock.json', `${JSON.stringify(lock, null, 2)}\n`, 'chore: lockfile');
    expectOk(cglg(repo.work, 'release', 'start', 'major', '--entry', 'changed: Y', '--approved'));
    const updated = repo.json('package-lock.json');
    expect([updated.version, updated.packages[''].version]).toEqual(['2.0.0', '2.0.0']);
  });

  test('add stashes entries and commits only changelog.json', () => {
    const repo = setupRepo();
    writeFileSync(join(repo.work, 'unrelated.txt'), 'x\n');
    expectOk(cglg(repo.work, 'add', 'fixed: One', '--changed', 'Two', '--approved'));
    expect(repo.json('changelog.json').temp).toEqual([{ type: 'fixed', value: 'One' }, { type: 'changed', value: 'Two' }]);
    expect(git(repo.work, 'status', '--porcelain')).toBe('?? unrelated.txt');
  });

  test('init saves the detected config and points agents to the guide', () => {
    const repo = setupRepo({ main: 'main', develop: false });
    repo.commit('AGENTS.md', '# Agents\n', 'docs: agents');
    expectOk(cglg(repo.work, 'init', '--no-confirm-changelog'));
    const data = repo.json('changelog.json');
    expect(Object.keys(data).slice(0, 3)).toEqual(['title', 'description', 'config']);
    expect(data.config).toMatchObject({ mainBranch: 'main', developBranch: null, releaseBranches: true, agent: { confirmChangelog: false } });
    expect(readFileSync(join(repo.work, 'AGENTS.md'), 'utf8')).toContain('run `cglg guide`');
    expect(git(repo.work, 'status', '--porcelain')).toBe('');

    const guide = expectOk(cglg(repo.work, 'guide')).out;
    expect(guide).toContain('Trunk: features and releases from/into main');
    expect(guide).toContain('No approval needed');
  });

  test('init can switch a trunk repo to GitFlow and creates develop', () => {
    const repo = setupRepo({ main: 'main', develop: false });
    expectOk(cglg(repo.work, 'init', '--develop', 'develop'));
    expect(repo.json('changelog.json').config.developBranch).toBe('develop');
    expect(gitOk(repo.work, 'rev-parse', '--verify', '--quiet', 'develop')).toBe(true);
  });

  test('non-git directory gives a clear error', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cglg-'));
    dirs.push(dir);
    mkdirSync(join(dir, 'sub'));
    const run = cglg(join(dir, 'sub'), 'feature', 'start', 'x');
    expect(run.code).toBe(1);
    expect(run.all).toContain('is not a git repository');
  });
});
