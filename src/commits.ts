import { type Entry, type EntryType } from './changelog';
import type { Ctx } from './context';
import { type Bump, compare, isValid, parse } from './semver';

export interface Commit {
  hash: string;
  subject: string;
  body: string;
  /** Entry type suggested from the commit message, "internal" for chores, null when unknown. */
  suggestion: EntryType | 'internal' | null;
  breaking: boolean;
}

export interface History {
  /** Tag (or ref) the range starts from; null = whole history. */
  since: string | null;
  commits: Commit[];
  truncated: boolean;
}

/** Commits created by changelog-flow itself. */
const TOOL_COMMIT = /^(Version \d+\.\d+\.\d+\S*$|TL: |chore\(changelog\): )/;

const CONVENTIONAL: Record<string, EntryType | 'internal'> = {
  feat: 'added', feature: 'added', add: 'added',
  fix: 'fixed', bugfix: 'fixed', hotfix: 'fixed',
  perf: 'changed', change: 'changed', revert: 'changed',
  security: 'security', sec: 'security',
  deprecate: 'deprecated', deprecated: 'deprecated',
  remove: 'removed', removed: 'removed',
  refactor: 'internal', chore: 'internal', docs: 'internal', doc: 'internal', test: 'internal', tests: 'internal',
  ci: 'internal', build: 'internal', style: 'internal', wip: 'internal'
};

export function classify(subject: string, body = ''): Pick<Commit, 'suggestion' | 'breaking'> {
  const breakingNote = /BREAKING[ -]CHANGE/.test(body);
  const conventional = /^(\w+)(?:\([^)]*\))?(!)?:\s/.exec(subject);
  if (conventional) {
    return {
      suggestion: CONVENTIONAL[conventional[1].toLowerCase()] ?? null,
      breaking: !!conventional[2] || breakingNote
    };
  }
  const word = /^\s*(\w+)/.exec(subject)?.[1].toLowerCase() ?? '';
  let suggestion: Commit['suggestion'] = null;
  if (/^(add|adds|added|implement|implemented|introduce|introduced|support)$/.test(word)) suggestion = 'added';
  else if (/^(fix|fixes|fixed|resolve|resolved|correct|corrected)$/.test(word)) suggestion = 'fixed';
  else if (/^(remove|removes|removed|drop|dropped|delete|deleted)$/.test(word)) suggestion = 'removed';
  else if (/^(deprecate|deprecates|deprecated)$/.test(word)) suggestion = 'deprecated';
  else if (/^(change|changes|changed|update|updates|updated|improve|improved|refine|rename|renamed)$/.test(word)) suggestion = 'changed';
  else if (/^(merge|wip|refactor|chore|bump)$/.test(word)) suggestion = 'internal';
  return { suggestion, breaking: breakingNote };
}

/** Tag of the most recent release: the newest version in changelog.json that has a tag, else the highest version tag. */
export function lastReleaseTag(ctx: Ctx): string | null {
  const tags = ctx.repo?.tags;
  if (!tags?.size) return null;
  const prefix = ctx.config.tagPrefix;
  for (const release of ctx.data?.changes ?? []) {
    const tag = `${prefix}${release.version}`;
    if (tags.has(tag)) return tag;
  }
  const versions = [...tags]
    .filter(tag => tag.startsWith(prefix) && isValid(tag.slice(prefix.length)))
    .sort((a, b) => compare(b.slice(prefix.length), a.slice(prefix.length)));
  return versions[0] ?? null;
}

export async function commitsInRange(ctx: Ctx, since: string | null, until = 'HEAD', limit = 300): Promise<History> {
  if (ctx.skipGit || !ctx.repo) return { since, commits: [], truncated: false };
  const range = since ? `${since}..${until}` : until;
  const result = await ctx.git.run(['log', '--no-merges', `--max-count=${limit + 1}`, '--format=%h%x1f%s%x1f%b%x1e', range]);
  if (result.code !== 0) return { since, commits: [], truncated: false };
  const commits: Commit[] = [];
  for (const record of result.stdout.split('\x1e')) {
    const [hash, subject, body = ''] = record.replace(/^\n/, '').split('\x1f');
    if (!hash || !subject || TOOL_COMMIT.test(subject)) continue;
    commits.push({ hash, subject, body: body.trim(), ...classify(subject, body) });
  }
  const truncated = commits.length > limit;
  return { since, commits: commits.slice(0, limit), truncated };
}

export function commitsSinceRelease(ctx: Ctx): Promise<History> {
  return commitsInRange(ctx, lastReleaseTag(ctx));
}

export function formatCommit(commit: Commit): string {
  const tags = [commit.suggestion && commit.suggestion !== 'internal' ? `suggested: ${commit.suggestion}` : commit.suggestion, commit.breaking ? 'BREAKING' : null]
    .filter(Boolean);
  return `${commit.hash} ${commit.subject}${tags.length ? `  [${tags.join(', ')}]` : ''}`;
}

export function formatHistory(history: History, max = 40): string[] {
  const lines = history.commits.slice(0, max).map(formatCommit);
  const hidden = history.commits.length - lines.length;
  if (hidden > 0 || history.truncated) lines.push(`… and more: run \`cglg commits\` for the full list`);
  return lines;
}

/** major for breaking changes (minor while 0.x), minor for new features, otherwise patch. */
export function suggestBump(current: string, commits: Commit[], entries: Entry[] = []): Bump {
  const breaking = commits.some(commit => commit.breaking) || entries.some(entry => entry.type === 'removed');
  const preStable = (parse(current)?.major ?? 0) === 0;
  if (breaking) return preStable ? 'minor' : 'major';
  if (entries.some(entry => entry.type === 'added') || commits.some(commit => commit.suggestion === 'added')) return 'minor';
  return 'patch';
}
