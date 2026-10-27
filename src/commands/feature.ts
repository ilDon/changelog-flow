import { flagString } from '../args';
import { entriesFromFlags, type Entry, formatEntry } from '../changelog';
import { commitsInRange } from '../commits';
import { BIN, type Ctx, getData, saveData } from '../context';
import { approvalStep, approve, collectEntries, entryWritingSteps, historySection } from '../entries';
import {
  baseBranch, branchExists, branchKind, checkout, commitFiles, createBranch, deleteLocalBranch, ensureClean, mergeBranch,
  PushPlan, refFor, requireBranch, requireRepo, slugify, validateFlowBranches, warnIfBehind
} from '../flow';
import { input } from '../prompt';
import { ActionRequired, CliError, type Outcome } from '../ui';

function requireFlow(ctx: Ctx, command: string): void {
  if (ctx.skipFlow) throw new CliError(`\`${command}\` works with branches, so it cannot run with --sg or --sf.`);
  requireRepo(ctx);
  validateFlowBranches(ctx);
}

export async function featureStart(ctx: Ctx): Promise<Outcome> {
  requireFlow(ctx, 'feature start');
  const cfg = ctx.config;
  const head = requireBranch(ctx);

  let name = ctx.args.join(' ').trim() || flagString(ctx.flags, 'name') || '';
  if (!name && ctx.interactive) while (!name) name = (await input('Feature name:')).trim();
  if (!name)
    throw new ActionRequired('Name the feature', [
      `Choose a short name that describes the work (for example "user-login"). It becomes the branch ${cfg.featurePrefix}<name>.`
    ], [], `${BIN} feature start <name>`);

  const slug = slugify(name.startsWith(cfg.featurePrefix) ? name.slice(cfg.featurePrefix.length) : name);
  if (!slug) throw new CliError(`"${name}" is not usable as a branch name.`);
  const branch = `${cfg.featurePrefix}${slug}`;
  if (branchExists(ctx, branch)) throw new CliError(`Branch ${branch} already exists.`, [`Switch to it with: git checkout ${branch}`]);

  const base = baseBranch(cfg);
  // Uncommitted work on the base branch simply moves to the new feature branch.
  const carried = head === base ? ctx.repo?.dirty.length ?? 0 : 0;
  if (!carried) await ensureClean(ctx);
  await checkout(ctx, base);
  warnIfBehind(ctx);
  await createBranch(ctx, branch);

  const push = new PushPlan(ctx);
  if (ctx.flags.push === true) {
    push.branch(branch);
    await push.run();
  }

  return {
    summary: `Started ${branch} from ${base}`,
    details: [
      ...(carried ? [`${carried} uncommitted file(s) moved to ${branch}`] : []),
      ...(push.pushed.length ? [`Pushed ${branch}`] : [])
    ],
    next: [`Commit your work on ${branch}.`, `When it is done: ${BIN} feature finish`],
    data: { branch, base }
  };
}

export async function featureFinish(ctx: Ctx): Promise<Outcome> {
  requireFlow(ctx, 'feature finish');
  const cfg = ctx.config;
  const repo = requireRepo(ctx);
  const head = requireBranch(ctx);
  const base = baseBranch(cfg);

  let feature: string;
  if (ctx.args[0]) {
    feature = ctx.args[0].startsWith(cfg.featurePrefix) ? ctx.args[0] : `${cfg.featurePrefix}${slugify(ctx.args[0])}`;
    if (!repo.localBranches.has(feature)) throw new CliError(`Branch ${feature} not found.`);
  } else if (branchKind(cfg, head) === 'feature') {
    feature = head;
  } else {
    const features = [...repo.localBranches].filter(branch => branch.startsWith(cfg.featurePrefix));
    throw new CliError(`You are on ${head}, not on a ${cfg.featurePrefix}* branch.`, features.length
      ? [`Check out the feature to finish, or run \`${BIN} feature finish <name>\`. Local features: ${features.join(', ')}`]
      : [`Start one with \`${BIN} feature start <name>\`.`]);
  }

  await ensureClean(ctx);

  const history = await commitsInRange(ctx, refFor(ctx, base), feature);
  let entries: Entry[] = entriesFromFlags(ctx.flags);
  const skip = ctx.flags['skip-entries'] === true || ctx.flags.entries === false;

  if (!entries.length && !skip) {
    if (ctx.interactive) {
      entries = await collectEntries(ctx, history, { question: 'Add changelog entries for this feature?', fallback: true });
    } else {
      throw new ActionRequired(`Record the changelog entries for ${feature}`, [
        ...entryWritingSteps(history),
        'The entries are stashed and go into the next release. If the feature has no user-facing changes, re-run with --skip-entries instead.',
        approvalStep(ctx)
      ], [historySection(history, `Commits in ${feature}`)],
      `${BIN} feature finish --entry "<type>: <text>"${ctx.config.confirmChangelog ? ' --approved' : ''}`,
      { feature, base, commits: history.commits });
    }
  }
  if (entries.length && !ctx.interactive) await approve(ctx, `Changelog entries for ${feature}`, entries.map(formatEntry));

  if (entries.length) {
    await checkout(ctx, feature);
    const data = getData(ctx);
    data.temp = [...(data.temp ?? []), ...entries];
    await commitFiles(ctx, saveData(ctx, false), `chore(changelog): stash entries for ${feature}`);
  }

  await mergeBranch(ctx, base, feature, [
    `Bring the feature up to date: git checkout ${feature} && git merge ${base}`,
    'Resolve the conflicts and commit.',
    `Run \`${BIN} feature finish\` again.`
  ], head);
  await deleteLocalBranch(ctx, feature);

  const push = new PushPlan(ctx).branch(base).remove(feature);
  await push.run();

  return {
    summary: `Merged ${feature} into ${base}`,
    details: [
      ...(entries.length ? [`Stashed ${entries.length} changelog entr${entries.length === 1 ? 'y' : 'ies'} for the next release`] : []),
      `Deleted ${feature}`,
      ...(push.pending ? [`Not pushed. To push later: ${push.pending}`] : push.pushed.length ? [`Pushed: ${push.pushed.join(', ')}`] : [])
    ],
    next: [`Start another feature (\`${BIN} feature start <name>\`) or release: \`${BIN} release start <patch|minor|major>\``],
    data: { feature, base, entries, pushed: push.pushed, pendingPush: push.pending }
  };
}
