import { describe, expect, test } from 'bun:test';
import { parseArgs } from '../src/args';
import { entriesFromFlags, parseEntry, renderMarkdown, todayISO } from '../src/changelog';
import { classify, suggestBump } from '../src/commits';
import { resolveConfig } from '../src/config';
import { parseStatus, type RepoState } from '../src/git';
import { slugify } from '../src/flow';
import { bump, compare, isValid } from '../src/semver';
import { findTopLevelVersion, setTopLevelVersion } from '../src/version';

describe('semver', () => {
  test('bumps like npm version', () => {
    expect(bump('1.2.3', 'patch')).toBe('1.2.4');
    expect(bump('1.2.3', 'minor')).toBe('1.3.0');
    expect(bump('1.2.3', 'major')).toBe('2.0.0');
    expect(bump('1.2.3-beta.1', 'patch')).toBe('1.2.3');
    expect(bump('1.3.0-rc.1', 'minor')).toBe('1.3.0');
    expect(bump('2.0.0-rc.1', 'major')).toBe('2.0.0');
    expect(bump('v0.9.9', 'minor')).toBe('0.10.0');
  });

  test('compares versions', () => {
    expect(compare('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compare('1.0.0', '1.0.0-rc.1')).toBeGreaterThan(0);
    expect(compare('1.0.0-alpha', '1.0.0-beta')).toBeLessThan(0);
    expect(compare('1.0.0-rc.2', '1.0.0-rc.10')).toBeLessThan(0);
    expect(compare('2.0.0', '2.0.0')).toBe(0);
  });

  test('validates', () => {
    expect(isValid('1.0.0')).toBe(true);
    expect(isValid('1.0')).toBe(false);
    expect(isValid('01.0.0')).toBe(false);
  });
});

describe('parseArgs', () => {
  test('commands, values, repeats and negations', () => {
    const { positionals, flags } = parseArgs([
      'release', 'start', 'minor', '--entry', 'added: A', '--entry=fixed: B', '--no-push', '--dry-run', '--cwd', '/tmp', '--fixed', 'C'
    ]);
    expect(positionals).toEqual(['release', 'start', 'minor']);
    expect(flags.entry).toEqual(['added: A', 'fixed: B']);
    expect(flags.fixed).toEqual(['C']);
    expect(flags.push).toBe(false);
    expect(flags['dry-run']).toBe(true);
    expect(flags.cwd).toBe('/tmp');
  });

  test('legacy flags', () => {
    const { flags } = parseArgs(['--action=newRelease', '--p', '--noTag', '--sg']);
    expect(flags.action).toBe('newRelease');
    expect(flags.p).toBe(true);
    expect(flags.tag).toBe(false);
    expect(flags.sg).toBe(true);
  });

  test('short flags and booleans', () => {
    const { flags } = parseArgs(['-n', '-e', 'fixed: x', '--confirm-changelog=false']);
    expect(flags['dry-run']).toBe(true);
    expect(flags.entry).toEqual(['fixed: x']);
    expect(flags['confirm-changelog']).toBe(false);
  });

  test('missing value is an error', () => {
    expect(() => parseArgs(['--message'])).toThrow('needs a value');
  });
});

describe('entries', () => {
  test('parses types and aliases', () => {
    expect(parseEntry('added: Login')).toEqual({ type: 'added', value: 'Login' });
    expect(parseEntry('feat: Login')).toEqual({ type: 'added', value: 'Login' });
    expect(parseEntry('Fix:  - Crash ')).toEqual({ type: 'fixed', value: 'Crash' });
    expect(parseEntry('security: a: b')).toEqual({ type: 'security', value: 'a: b' });
  });

  test('rejects invalid entries', () => {
    expect(() => parseEntry('something')).toThrow('Invalid changelog entry');
    expect(() => parseEntry('wat: x')).toThrow('Invalid changelog entry');
    expect(() => parseEntry('fixed:   ')).toThrow('has no text');
  });

  test('collects flags and shorthands', () => {
    const entries = entriesFromFlags({ entry: ['added: A'], removed: ['B'] }, ['fixed: C']);
    expect(entries).toEqual([
      { type: 'added', value: 'A' },
      { type: 'fixed', value: 'C' },
      { type: 'removed', value: 'B' }
    ]);
  });
});

describe('renderMarkdown', () => {
  test('keeps the Keep a Changelog layout and order', () => {
    const md = renderMarkdown({
      title: 'Changelog',
      description: 'Desc',
      changes: [{
        version: '1.1.0',
        date: '2026-01-02',
        items: [
          { type: 'fixed', value: 'crash;' },
          { type: 'added', value: 'feature' },
          { type: 'removed', value: 'old api!' },
          { type: 'changed', value: 'two\nlines.' }
        ]
      }]
    });
    expect(md).toBe(
      '# Changelog\nDesc\n\n---\n\n' +
      '## [1.1.0] - 2026-01-02\n' +
      '### Added\n- feature.\n\n' +
      '### Changed\n- two\n  lines.\n\n' +
      '### Removed\n- old api!\n\n' +
      '### Fixed\n- crash.\n\n'
    );
  });

  test('formats dates', () => {
    expect(todayISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('version files', () => {
  test('finds only the top-level version', () => {
    const text = '{\n  "name": "version",\n  "engines": { "version": "9.9.9" },\n  "list": ["version"],\n  "version": "1.2.3"\n}\n';
    expect(findTopLevelVersion(text)?.value).toBe('1.2.3');
    expect(setTopLevelVersion(text, '2.0.0', 'x.json')).toBe(text.replace('"1.2.3"', '"2.0.0"'));
  });

  test('preserves formatting', () => {
    const text = '{"name":"a",\t"version" : "0.1.0","x":{"y":1}}';
    expect(setTopLevelVersion(text, '0.2.0', 'x.json')).toBe('{"name":"a",\t"version" : "0.2.0","x":{"y":1}}');
  });

  test('errors when missing', () => {
    expect(findTopLevelVersion('{"a":{"version":"1.0.0"}}')).toBeNull();
    expect(() => setTopLevelVersion('{"version": 1}', '1.0.0', 'x.json')).toThrow('no top-level');
  });
});

describe('commits', () => {
  test('classifies conventional and plain messages', () => {
    expect(classify('feat(ui): add button')).toEqual({ suggestion: 'added', breaking: false });
    expect(classify('fix!: change api')).toEqual({ suggestion: 'fixed', breaking: true });
    expect(classify('chore: bump deps')).toEqual({ suggestion: 'internal', breaking: false });
    expect(classify('refactor: x', 'BREAKING CHANGE: y')).toEqual({ suggestion: 'internal', breaking: true });
    expect(classify('Fixed the login crash')).toEqual({ suggestion: 'fixed', breaking: false });
    expect(classify('Added dark mode')).toEqual({ suggestion: 'added', breaking: false });
    expect(classify('Something else')).toEqual({ suggestion: null, breaking: false });
  });

  test('suggests a bump', () => {
    const commit = (suggestion: 'added' | 'fixed', breaking = false) => ({ hash: 'h', subject: 's', body: '', suggestion, breaking });
    expect(suggestBump('1.0.0', [commit('fixed')])).toBe('patch');
    expect(suggestBump('1.0.0', [commit('fixed'), commit('added')])).toBe('minor');
    expect(suggestBump('1.0.0', [commit('fixed', true)])).toBe('major');
    expect(suggestBump('0.4.0', [commit('fixed', true)])).toBe('minor');
    expect(suggestBump('1.0.0', [], [{ type: 'removed', value: 'x' }])).toBe('major');
  });
});

describe('git status parsing', () => {
  test('reads branch, tracking and dirty files', () => {
    const state = parseStatus([
      '# branch.oid abc',
      '# branch.head feature/x',
      '# branch.upstream origin/feature/x',
      '# branch.ab +2 -1',
      '1 .M N... 100644 100644 100644 abc abc src/a file.ts',
      '2 R. N... 100644 100644 100644 abc abc R100 new.ts\told.ts',
      '? untracked/'
    ].join('\n'));
    expect(state.branch).toBe('feature/x');
    expect(state.upstream).toBe('origin/feature/x');
    expect([state.ahead, state.behind]).toEqual([2, 1]);
    expect(state.dirty).toEqual(['src/a file.ts', 'new.ts', 'untracked/']);
  });

  test('detached head', () => {
    expect(parseStatus('# branch.head (detached)\n').branch).toBeNull();
  });
});

describe('config', () => {
  const repo = (branches: string[], remote: string[] = []): RepoState => ({
    branch: branches[0], upstream: null, ahead: 0, behind: 0, dirty: [],
    localBranches: new Set(branches), remoteBranches: new Set(remote), remoteHeads: new Map(), tags: new Set(), remotes: ['origin']
  });

  test('detects gitflow and trunk', () => {
    expect(resolveConfig(undefined, repo(['develop', 'master']), {}, '/nonexistent')).toMatchObject({ mainBranch: 'master', developBranch: 'develop' });
    expect(resolveConfig(undefined, repo(['main']), {}, '/nonexistent')).toMatchObject({ mainBranch: 'main', developBranch: null });
    expect(resolveConfig(undefined, repo(['master'], ['origin/develop']), {}, '/nonexistent').developBranch).toBe('develop');
  });

  test('file config and flags win over detection', () => {
    const cfg = resolveConfig({ developBranch: null, mainBranch: 'trunk', releaseBranches: false }, repo(['develop', 'trunk']), { push: false }, '/nonexistent');
    expect(cfg).toMatchObject({ mainBranch: 'trunk', developBranch: null, releaseBranches: false, push: false });
    expect(resolveConfig(undefined, repo(['develop', 'main']), { develop: false }, '/nonexistent').developBranch).toBeNull();
  });
});

describe('slugify', () => {
  test('makes branch-safe names', () => {
    expect(slugify('Pagina Città  è bella!')).toBe('pagina-citta-e-bella');
    expect(slugify('  Fix: login/flow v1.2 ')).toBe('fix-login-flow-v1.2');
    expect(slugify('Straße & Œuvre')).toBe('strasse-oeuvre');
  });
});
