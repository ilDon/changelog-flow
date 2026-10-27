import { flagString } from '../args';
import { formatEntry } from '../changelog';
import { commitsInRange, commitsSinceRelease, formatHistory, type History } from '../commits';
import { describeFlow } from '../config';
import { BIN, type Ctx, versionOf } from '../context';
import { baseBranch, type BranchKind, branchKind } from '../flow';
import { bold, dim, type Outcome } from '../ui';

function nextSteps(ctx: Ctx, kind: BranchKind | null, history: History): string[] {
  const cfg = ctx.config;
  const repo = ctx.repo;
  const base = baseBranch(cfg);
  if (!repo) return ctx.skipGit ? [`Release with \`${BIN} release start <patch|minor|major> --sg\` (files only).`] : ['Not a git repository: run inside one, or pass --sg to only manage the changelog files.'];

  const steps: string[] = [];
  if (repo.dirty.length) steps.push('Commit the uncommitted changes first (or pass --message "<commit message>" to the next cglg command).');
  const releases = [...repo.localBranches].filter(branch => branch.startsWith(cfg.releasePrefix));
  if (releases.length && kind !== 'release') steps.push(`Release in progress on ${releases.join(', ')}: finish it with \`${BIN} release finish\`.`);

  switch (kind) {
    case null:
      steps.push('HEAD is detached: check out a branch.');
      break;
    case 'feature':
      steps.push(
        `Keep committing on ${ctx.head}. When the feature is done: \`${BIN} feature finish\` (records its changelog entries and merges it into ${base}).`,
        `Or release right away: \`${BIN} release start <patch|minor|major>\` (merges the feature first).`
      );
      break;
    case 'release':
      steps.push(`Build, test and publish if needed (commit fixes on ${ctx.head}), then: \`${BIN} release finish\`.`);
      break;
    case 'main':
      if (cfg.developBranch) {
        steps.push(`Work starts from ${cfg.developBranch} in this project: git checkout ${cfg.developBranch}`);
        break;
      }
    // falls through: in trunk mode main is the base branch
    case 'develop':
      steps.push(`Start a feature: \`${BIN} feature start <name>\`.`);
      steps.push(history.commits.length
        ? `Release the ${history.commits.length} commit(s) since ${history.since ?? 'the start'}: \`${BIN} release start <patch|minor|major>\`.`
        : `Nothing new to release${history.since ? ` since ${history.since}` : ''}.`);
      break;
    case 'other':
      steps.push(`${ctx.head} is not managed by changelog-flow. Switch to ${base}, or rename it to ${cfg.featurePrefix}<name>.`);
      break;
  }
  if (!ctx.data) steps.push(`Optional: \`${BIN} init\` saves the branching model and agent policy in changelog.json (now auto-detected).`);
  return steps;
}

export async function status(ctx: Ctx): Promise<Outcome> {
  const cfg = ctx.config;
  const repo = ctx.repo;
  const version = versionOf(ctx);
  const kind = ctx.head ? branchKind(cfg, ctx.head) : repo ? null : 'other';
  const history = repo ? await commitsSinceRelease(ctx) : { since: null, commits: [], truncated: false };
  const stashed = ctx.data?.temp ?? [];
  const next = nextSteps(ctx, kind, history);

  const data = {
    cwd: ctx.cwd,
    initialized: !!ctx.data,
    branch: ctx.head,
    branchKind: kind,
    flow: describeFlow(cfg),
    config: cfg,
    version: version.version,
    versionSource: version.source,
    lastRelease: history.since,
    dirty: repo?.dirty ?? [],
    stashed,
    commits: history.commits,
    next
  };

  if (!ctx.json) {
    const row = (label: string, value: string): string => `  ${label.padEnd(13)} ${value}`;
    const lines = [
      bold(`changelog-flow · ${ctx.cwd}`),
      row('Branching', describeFlow(cfg)),
      row('Branch', repo ? `${ctx.head ?? '(detached)'}${kind ? dim(` (${kind})`) : ''}` : dim('not a git repository')),
      row('Version', `${version.version} ${dim(`(${version.source})`)}${history.since ? ` · last release ${history.since}` : ''}`),
      row('Working tree', repo ? (repo.dirty.length ? `${repo.dirty.length} uncommitted file(s)` : 'clean') : '-'),
      row('Changelog', ctx.data ? `changelog.json · ${stashed.length} stashed entr${stashed.length === 1 ? 'y' : 'ies'}` : 'changelog.json not created yet'),
      row('Agents', cfg.confirmChangelog ? 'must get user approval for changelog entries' : 'write changelog entries without asking')
    ];
    if (stashed.length) lines.push('', bold('Stashed entries:'), ...stashed.map(entry => `  ${formatEntry(entry)}`));
    if (repo) {
      lines.push('', bold(`Commits since ${history.since ?? 'the beginning'} (${history.commits.length}${history.truncated ? '+' : ''}):`));
      lines.push(...(history.commits.length ? formatHistory(history, 20).map(line => `  ${line}`) : [dim('  (none)')]));
    }
    lines.push('', bold('Next:'), ...next.map(step => `  → ${step}`));
    if (!ctx.interactive) lines.push('', dim(`Agents: run \`${BIN} guide\` for the full procedure.`));
    process.stdout.write(`${lines.join('\n')}\n`);
  }

  return { summary: 'Status', data, next, printed: true };
}

export async function commits(ctx: Ctx): Promise<Outcome> {
  const since = flagString(ctx.flags, 'since');
  const history = since ? await commitsInRange(ctx, since, 'HEAD', 5000) : await commitsSinceRelease(ctx);
  if (!ctx.json) {
    const title = `Commits since ${history.since ?? 'the beginning'} (${history.commits.length}):`;
    const lines = history.commits.map(commit => `  ${formatHistory({ ...history, commits: [commit] })[0]}${commit.body ? `\n${commit.body.split('\n').map(line => dim(`      ${line}`)).join('\n')}` : ''}`);
    process.stdout.write(`${bold(title)}\n${lines.join('\n') || dim('  (none)')}\n`);
  }
  return { summary: 'Commits', data: history, printed: true };
}
