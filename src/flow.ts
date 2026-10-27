import type { Config } from './config';
import { BIN, type Ctx, rerun } from './context';
import type { RepoState } from './git';
import { confirm, input } from './prompt';
import { ActionRequired, CliError, shellQuote } from './ui';

export type BranchKind = 'feature' | 'release' | 'main' | 'develop' | 'other';

export function branchKind(cfg: Config, branch: string): BranchKind {
  if (branch === cfg.mainBranch) return 'main';
  if (cfg.developBranch && branch === cfg.developBranch) return 'develop';
  if (branch.startsWith(cfg.featurePrefix)) return 'feature';
  if (branch.startsWith(cfg.releasePrefix)) return 'release';
  return 'other';
}

/** Branch features start from and merge into. */
export function baseBranch(cfg: Config): string {
  return cfg.developBranch ?? cfg.mainBranch;
}

export function requireRepo(ctx: Ctx): RepoState {
  if (!ctx.repo) throw new CliError(`${ctx.cwd} is not a git repository.`, ['Run the command inside a git repository, or pass --sg to skip all git operations.']);
  return ctx.repo;
}

export function requireBranch(ctx: Ctx): string {
  requireRepo(ctx);
  if (!ctx.head) throw new CliError('HEAD is detached.', ['Check out a branch first (git checkout <branch>).']);
  return ctx.head;
}

export function branchExists(ctx: Ctx, name: string): boolean {
  return !!ctx.repo && (ctx.repo.localBranches.has(name) || remoteHas(ctx, name));
}

export function remoteHas(ctx: Ctx, name: string): boolean {
  return !!ctx.repo?.remoteBranches.has(`${ctx.config.remote}/${name}`);
}

/** A ref usable in read-only commands even if the branch only exists on the remote. */
export function refFor(ctx: Ctx, name: string): string {
  return ctx.repo?.localBranches.has(name) ? name : `${ctx.config.remote}/${name}`;
}

/** Makes sure the configured main/develop branches exist before we change anything. */
export function validateFlowBranches(ctx: Ctx): void {
  const cfg = ctx.config;
  if (!branchExists(ctx, cfg.mainBranch))
    throw new CliError(`Main branch "${cfg.mainBranch}" does not exist.`, [
      `Create it, or set "mainBranch" in the "config" section of changelog.json (or run \`${BIN} init\`).`
    ]);
  if (cfg.developBranch && !branchExists(ctx, cfg.developBranch))
    throw new CliError(`Develop branch "${cfg.developBranch}" does not exist.`, [
      `Create it with: git branch ${cfg.developBranch} ${cfg.mainBranch}`,
      `Or work directly on ${cfg.mainBranch}: set "developBranch": null in the "config" section of changelog.json.`
    ]);
}

export function warnIfBehind(ctx: Ctx): void {
  if (ctx.repo?.behind && ctx.repo.upstream)
    ctx.report.warn(`${ctx.head} is ${ctx.repo.behind} commit(s) behind ${ctx.repo.upstream} (as of the last fetch). Consider \`git pull\` first.`);
}

export async function checkout(ctx: Ctx, branch: string): Promise<void> {
  if (ctx.head === branch) return;
  await ctx.git.exec(['checkout', '--quiet', branch]);
  ctx.head = branch;
}

export async function createBranch(ctx: Ctx, name: string): Promise<void> {
  await ctx.git.exec(['checkout', '--quiet', '-b', name]);
  ctx.head = name;
  ctx.repo?.localBranches.add(name);
}

/** Deletes a local branch after checking it is merged into HEAD (`-d` alone also compares with its upstream). */
export async function deleteLocalBranch(ctx: Ctx, name: string): Promise<void> {
  if (!ctx.dryRun && !(await isAncestor(ctx, name, 'HEAD')))
    throw new CliError(`${name} is not fully merged into ${ctx.head}, so it was not deleted.`);
  await ctx.git.exec(['branch', '--quiet', '-D', name]);
  ctx.repo?.localBranches.delete(name);
}

export async function isAncestor(ctx: Ctx, ancestor: string, ref: string): Promise<boolean> {
  return (await ctx.git.run(['merge-base', '--is-ancestor', ancestor, ref])).code === 0;
}

/** Conflicting files if merging `source` into `target` would conflict, [] if clean, null if unknown (git < 2.38). */
export async function predictConflicts(ctx: Ctx, target: string, source: string): Promise<string[] | null> {
  const result = await ctx.git.run(['merge-tree', '--write-tree', '--name-only', '--no-messages', refFor(ctx, target), refFor(ctx, source)]);
  if (result.code === 0) return [];
  if (result.code !== 1) return null;
  const [, ...files] = result.stdout.split('\n');
  return [...new Set(files.filter(Boolean))];
}

/**
 * Merges `source` into `target` (checking out `target`). On failure the merge is aborted,
 * `returnTo` is checked out again and a CliError with `hints` is thrown.
 */
export async function mergeBranch(ctx: Ctx, target: string, source: string, hints: string[], returnTo?: string): Promise<void> {
  ctx.report.step(`Merging ${source} into ${target}`);
  await checkout(ctx, target);
  const args = ['merge', '--no-edit', ...(ctx.config.noFastForward ? ['--no-ff'] : []), source];
  const result = await ctx.git.attempt(args);
  if (result.code === 0) return;
  await ctx.git.run(['merge', '--abort']);
  if (returnTo) await checkout(ctx, returnTo);
  throw new CliError(`Merging ${source} into ${target} failed. The merge was aborted and nothing was pushed.\n${(result.stdout + result.stderr).trim()}`, hints);
}

export async function commitFiles(ctx: Ctx, files: string[], message: string): Promise<void> {
  if (ctx.skipGit) return;
  await ctx.git.exec(['add', '--', ...files]);
  const result = await ctx.git.attempt(['commit', '--quiet', '-m', message]);
  if (result.code !== 0 && !/nothing (added )?to commit|no changes added/.test(result.stdout + result.stderr))
    throw new CliError(`git commit failed:\n${(result.stderr || result.stdout).trim()}`);
}

/** Uncommitted changes block every flow command. Commits them on request, otherwise explains what to do. */
export async function ensureClean(ctx: Ctx): Promise<void> {
  if (ctx.skipGit) return;
  const repo = requireRepo(ctx);
  if (!repo.dirty.length) return;

  let message = typeof ctx.flags.message === 'string' ? ctx.flags.message.trim() : '';
  if (!message && ctx.interactive) {
    ctx.report.warn(`There are uncommitted changes:\n${repo.dirty.map(file => `    ${file}`).join('\n')}`);
    if (!(await confirm('Commit them now?', true)))
      throw new CliError('Commit or stash your changes, then run the command again.');
    while (!message) message = await input('Commit message:');
  }
  if (!message) {
    throw new ActionRequired('There are uncommitted changes in the working tree', [
      'Review them (git status, git diff) and commit them with a meaningful message describing the change.',
      `Either commit yourself (git add … && git commit -m "…"), or re-run with --message "<commit message>" to let ${BIN} commit everything listed below.`,
      'If some files must not be committed, stash or discard them first. Ask the user if you are not sure.'
    ], [{ title: 'Uncommitted files', lines: repo.dirty }], rerun(ctx, ['--message', '<commit message>']));
  }

  await ctx.git.exec(['add', '--all']);
  await ctx.git.exec(['commit', '--quiet', '-m', message]);
  repo.dirty = [];
}

/** Collects refs to push and pushes them all in a single atomic `git push`. */
export class PushPlan {
  private branches = new Set<string>();
  private tags = new Set<string>();
  private deletes = new Set<string>();
  /** Set when pushing was skipped: the command to run later. */
  pending: string | null = null;
  pushed: string[] = [];

  constructor(private ctx: Ctx) {}

  branch(name: string): this {
    this.branches.add(name);
    this.deletes.delete(name);
    return this;
  }

  tag(name: string): this {
    this.tags.add(name);
    return this;
  }

  /** Deletes the branch on the remote, if the remote has it. */
  remove(name: string): this {
    if (remoteHas(this.ctx, name)) this.deletes.add(name);
    this.branches.delete(name);
    return this;
  }

  private refspecs(withDeletes: boolean): string[] {
    return [
      ...[...this.branches].map(name => `refs/heads/${name}:refs/heads/${name}`),
      ...[...this.tags].map(name => `refs/tags/${name}:refs/tags/${name}`),
      ...(withDeletes ? [...this.deletes].map(name => `:refs/heads/${name}`) : [])
    ];
  }

  describe(): string[] {
    return [...this.branches, ...[...this.tags].map(tag => `tag ${tag}`), ...[...this.deletes].map(name => `delete ${name}`)];
  }

  async run(): Promise<void> {
    const ctx = this.ctx;
    const { remote, push } = ctx.config;
    if (!this.branches.size && !this.tags.size && !this.deletes.size) return;

    const command = (atomic: boolean, deletes: boolean): string[] =>
      ['push', ...(atomic ? ['--atomic'] : []), '--set-upstream', remote, ...this.refspecs(deletes)];

    if (!push || !ctx.repo?.remotes.includes(remote)) {
      const pretty = ['git', 'push', '--atomic', remote, ...[...this.branches], ...[...this.tags], ...[...this.deletes].map(name => `:${name}`)];
      this.pending = pretty.map(shellQuote).join(' ');
      ctx.report.step(push ? `No remote "${remote}": nothing pushed.` : 'Push disabled: nothing pushed.');
      return;
    }

    ctx.report.step(`Pushing to ${remote}: ${this.describe().join(', ')}`);
    let atomic = true;
    let deletes = true;
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await ctx.git.attempt(command(atomic, deletes));
      if (result.code === 0) {
        // In dry-run nothing left the machine: report nothing as pushed.
        if (!ctx.dryRun) this.pushed = this.describe();
        return;
      }
      const output = result.stderr + result.stdout;
      if (atomic && /atomic/i.test(output) && /support/i.test(output)) {
        atomic = false;
        continue;
      }
      if (deletes && /remote ref does not exist|unable to delete/i.test(output)) {
        deletes = false;
        continue;
      }
      const rejected = /rejected|non-fast-forward|fetch first/i.test(output);
      throw new CliError(`Push to ${remote} failed. Everything is done locally; only the push is missing.\n${output.trim()}`, [
        ...(rejected ? [`The remote has commits you don't have: pull them into the affected branches (git pull) and resolve any conflict.`] : []),
        `Then push with: git ${command(atomic, deletes).map(shellQuote).join(' ')}`
      ]);
    }
  }
}

export interface CompleteReleaseOptions {
  source: string;
  version: string;
  tagName: string | null;
  push: PushPlan;
  deleteSource: boolean;
}

/**
 * Merges `source` into the main branch (and develop, if any), tags the release and
 * schedules the pushes. Idempotent: steps already done (merges, tag) are skipped, so
 * the command can simply be re-run after fixing a problem.
 */
export async function completeRelease(ctx: Ctx, options: CompleteReleaseOptions): Promise<void> {
  const cfg = ctx.config;
  const { source, tagName, push } = options;
  const targets = [cfg.mainBranch, ...(cfg.developBranch && cfg.developBranch !== source ? [cfg.developBranch] : [])]
    .filter(target => target !== source);

  // Check every merge up front, so a conflict never leaves the release half done.
  const toMerge: string[] = [];
  for (const target of targets) {
    if (await isAncestor(ctx, source, refFor(ctx, target))) {
      ctx.report.step(`${source} is already merged into ${target}`);
      continue;
    }
    const conflicts = await predictConflicts(ctx, target, source);
    if (conflicts?.length) {
      const isMain = target === cfg.mainBranch;
      throw new CliError(`Merging ${source} into ${target} would conflict in: ${conflicts.join(', ')}. Nothing was changed.`, isMain
        ? [
            `Bring ${source} up to date: git checkout ${source} && git merge ${target}`,
            'Resolve the conflicts and commit.',
            `Run \`${BIN} release finish\` again.`
          ]
        : [
            `Merge it yourself: git checkout ${target} && git merge ${source}`,
            'Resolve the conflicts and commit.',
            `Run \`${BIN} release finish\` again: completed steps are skipped.`
          ]);
    }
    toMerge.push(target);
  }

  const startedOn = ctx.head;
  if (toMerge.includes(cfg.mainBranch)) {
    await mergeBranch(ctx, cfg.mainBranch, source, [`Fix the problem above, then run \`${BIN} release finish\` again.`], startedOn ?? undefined);
  }
  push.branch(cfg.mainBranch);

  if (tagName) {
    if (ctx.repo?.tags.has(tagName)) {
      if (!(await isAncestor(ctx, source, tagName)))
        throw new CliError(`Tag ${tagName} already exists and points to a different commit.`, [`Delete or rename it (git tag -d ${tagName}), then run the command again.`]);
      ctx.report.step(`Tag ${tagName} already exists`);
    } else {
      await checkout(ctx, cfg.mainBranch);
      await ctx.git.exec(['tag', '-a', tagName, '-m', `Version ${options.version}`]);
      ctx.repo?.tags.add(tagName);
    }
    push.tag(tagName);
  }

  if (cfg.developBranch && cfg.developBranch !== source) {
    if (toMerge.includes(cfg.developBranch))
      await mergeBranch(ctx, cfg.developBranch, source, [`Fix the problem above, then run \`${BIN} release finish\` again: completed steps are skipped.`]);
    push.branch(cfg.developBranch);
  }

  await checkout(ctx, baseBranch(cfg));
  if (!options.deleteSource) push.branch(source);
  else if (ctx.repo?.localBranches.has(source)) {
    await deleteLocalBranch(ctx, source);
    push.remove(source);
  }
}

/** Turns free text into a branch-safe slug. */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/œ/g, 'oe')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^[-.]+|[-.]+$/g, '')
    .replace(/-{2,}/g, '-');
}
