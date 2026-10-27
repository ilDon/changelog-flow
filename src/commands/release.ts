import { entriesFromFlags, type Entry, formatEntry, todayISO } from '../changelog';
import { commitsSinceRelease, type History, suggestBump } from '../commits';
import { BIN, type Ctx, getData, passthroughFlags, saveData, versionOf, writeProjectFile } from '../context';
import { approvalStep, approve, collectEntries, entriesSection, entryWritingSteps, historySection } from '../entries';
import {
  baseBranch, branchExists, branchKind, checkout, commitFiles, completeRelease, createBranch, deleteLocalBranch, ensureClean,
  mergeBranch, PushPlan, requireBranch, requireRepo, validateFlowBranches, warnIfBehind
} from '../flow';
import { select } from '../prompt';
import { type Bump, BUMPS, bump, clean, compare, isValid } from '../semver';
import { ActionRequired, CliError, dim, type Outcome, shellQuote } from '../ui';
import { versionFileUpdates } from '../version';

const LEGACY_BUMP_FLAGS: Record<string, Bump> = { p: 'patch', f: 'minor', m: 'major', patch: 'patch', minor: 'minor', major: 'major' };

/** The bump requested on the command line: `patch|minor|major|x.y.z` positional or --patch/--minor/--major (legacy --p/--f/--m). */
function requestedBump(ctx: Ctx): { bump?: Bump; version?: string; rest: string[] } {
  const rest: string[] = [];
  let result: { bump?: Bump; version?: string } = {};
  for (const arg of ctx.args) {
    if ((BUMPS as string[]).includes(arg) && !result.bump && !result.version) result = { bump: arg as Bump };
    else if (isValid(arg) && !result.bump && !result.version) result = { version: clean(arg) };
    else rest.push(arg);
  }
  for (const [flag, type] of Object.entries(LEGACY_BUMP_FLAGS))
    if (ctx.flags[flag] === true && !result.bump && !result.version) result = { bump: type };
  return { ...result, rest };
}

function pushDetails(push: PushPlan): string[] {
  if (push.pending) return [`Not pushed. To push later: ${push.pending}`];
  if (push.pushed.length) return [`Pushed: ${push.pushed.join(', ')}`];
  return [];
}

export async function releaseStart(ctx: Ctx): Promise<Outcome> {
  const cfg = ctx.config;
  const useFlow = !ctx.skipFlow;
  let feature: string | null = null;

  if (!ctx.skipGit) requireRepo(ctx);
  if (useFlow) {
    validateFlowBranches(ctx);
    const branch = requireBranch(ctx);
    const kind = branchKind(cfg, branch);
    if (kind === 'release')
      throw new CliError(`A release is already in progress on ${branch}.`, [`Finish it first with \`${BIN} release finish\`.`]);
    if (kind === 'main' && cfg.developBranch)
      throw new CliError(`You are on ${branch}, but releases start from ${cfg.developBranch} in this project.`, [`git checkout ${cfg.developBranch}, then run the command again.`]);
    if (kind === 'other')
      throw new CliError(`${branch} is neither the base branch (${baseBranch(cfg)}) nor a ${cfg.featurePrefix}* branch.`, [
        `Switch to ${baseBranch(cfg)} (or to a feature branch) first, or pass --sf to release from the current branch without branching.`
      ]);
    if (kind === 'feature') feature = branch;
    warnIfBehind(ctx);
  }

  await ensureClean(ctx);

  const { version: current } = versionOf(ctx);
  const requested = requestedBump(ctx);
  const given = entriesFromFlags(ctx.flags, requested.rest);
  const stashed = ctx.data?.temp ?? [];
  let includeStashed = ctx.flags.stashed !== false && stashed.length > 0;
  const history: History = ctx.skipGit ? { since: null, commits: [], truncated: false } : await commitsSinceRelease(ctx);

  let next = requested.version ?? (requested.bump ? bump(current, requested.bump) : null);
  let newEntries = given;

  if (ctx.interactive) {
    if (includeStashed) {
      ctx.report.plain(`\nStashed entries:\n${stashed.map(entry => dim(`  ${formatEntry(entry)}`)).join('\n')}`);
      includeStashed = await select('Include the stashed entries in this release?', [
        { label: 'Yes', value: true },
        { label: 'No, keep them for a later release', value: false }
      ]);
    }
    if (!newEntries.length)
      newEntries = await collectEntries(ctx, history, includeStashed ? { question: 'Add more changelog entries?', fallback: false } : undefined);
    if (!next) {
      const suggested = suggestBump(current, history.commits, [...newEntries, ...(includeStashed ? stashed : [])]);
      const type = await select<Bump>(`Version bump (current ${current})?`, BUMPS.map(value => ({
        label: `${value} → ${bump(current, value)}`,
        hint: dim(value === suggested ? 'suggested' : value === 'major' ? 'breaking changes' : value === 'minor' ? 'new features' : 'fixes'),
        value
      })), BUMPS.indexOf(suggested));
      next = bump(current, type);
    }
  } else {
    const missingEntries = !newEntries.length && ctx.flags['new-entries'] !== false;
    if (!next || missingEntries) throw releaseInputsRequired(ctx, { current, history, stashed: includeStashed ? stashed : [], given, next, missingEntries });
  }

  const entries: Entry[] = [...(includeStashed ? stashed : []), ...newEntries];
  if (!entries.length)
    throw new CliError('A release needs at least one changelog entry.', [`Pass entries with --entry "<type>: <text>" or stash them first with \`${BIN} add\`.`]);
  if (!next) throw new CliError('No version chosen.');
  if (compare(next, current) <= 0 && ctx.flags.force !== true)
    throw new CliError(`New version ${next} must be greater than the current ${current}.`, ['Pass --force to use it anyway.']);
  if (ctx.data?.changes.some(release => release.version === next))
    throw new CliError(`Version ${next} is already in changelog.json.`);

  const tagName = cfg.tag ? `${cfg.tagPrefix}${next}` : null;
  const releaseBranch = useFlow && cfg.releaseBranches ? `${cfg.releasePrefix}${next}` : null;
  if (!ctx.skipGit && tagName && ctx.repo?.tags.has(tagName))
    throw new CliError(`Tag ${tagName} already exists.`);
  if (releaseBranch && branchExists(ctx, releaseBranch))
    throw new CliError(`Branch ${releaseBranch} already exists.`, [`Finish it with \`${BIN} release finish\` or delete it.`]);

  const plan = [
    `Version ${current} → ${next}`,
    ...entries.map(entry => `• ${formatEntry(entry)}`),
    ...(feature ? [`Merge ${feature} into ${baseBranch(cfg)}`] : []),
    ...(releaseBranch ? [`Create ${releaseBranch} from ${baseBranch(cfg)}`] : []),
    ...(!releaseBranch && !ctx.skipGit ? [`Commit${tagName ? `, tag ${tagName}` : ''} and release on ${useFlow ? cfg.mainBranch : ctx.head}`] : [])
  ];
  await approve(ctx, `Release ${next}`, plan);

  // From here on we change things.
  const push = new PushPlan(ctx);
  const base = baseBranch(cfg);
  if (useFlow) {
    if (feature) {
      await mergeBranch(ctx, base, feature, [
        `Bring the feature up to date: git merge ${base} (on ${feature}), resolve the conflicts and commit.`,
        `Then run \`${BIN} release start\` again.`
      ], feature);
      await deleteLocalBranch(ctx, feature);
      push.branch(base).remove(feature);
    }
    await checkout(ctx, base);
    if (releaseBranch) await createBranch(ctx, releaseBranch);
  }

  const data = getData(ctx);
  data.changes.unshift({ version: next, date: todayISO(), items: entries });
  if (includeStashed) data.temp = [];
  const files: string[] = [];
  for (const [file, contents] of versionFileUpdates(ctx.cwd, cfg.versionFiles, next)) {
    writeProjectFile(ctx, file, contents);
    files.push(file);
  }
  files.push(...saveData(ctx, true));

  if (!ctx.skipGit) {
    await commitFiles(ctx, files, `Version ${next}`);
    if (releaseBranch) push.branch(releaseBranch);
    else if (useFlow) await completeRelease(ctx, { source: base, version: next, tagName, push, deleteSource: false });
    else {
      if (tagName) {
        await ctx.git.exec(['tag', '-a', tagName, '-m', `Version ${next}`]);
        push.tag(tagName);
      }
      if (ctx.head) push.branch(ctx.head);
    }
    await push.run();
  }

  const finished = !releaseBranch;
  return {
    summary: finished ? `Released ${next}` : `Release ${next} started on ${releaseBranch}`,
    details: [
      `Updated: ${files.join(', ')}`,
      ...(tagName && finished && !ctx.skipGit ? [`Tagged ${tagName}`] : []),
      ...pushDetails(push)
    ],
    next: finished
      ? ['Publish or deploy the release if the project needs it.']
      : [`Build, test and publish if the project needs it (fixes can be committed on ${releaseBranch}).`, `Then run: ${BIN} release finish`],
    data: { version: next, previous: current, entries, branch: releaseBranch, tag: tagName, files, pushed: push.pushed, pendingPush: push.pending }
  };
}

interface MissingInputs {
  current: string;
  history: History;
  stashed: Entry[];
  given: Entry[];
  next: string | null;
  missingEntries: boolean;
}

function releaseInputsRequired(ctx: Ctx, m: MissingInputs): ActionRequired {
  const suggested = suggestBump(m.current, m.history.commits, [...m.given, ...m.stashed]);
  const steps: string[] = [];
  if (m.missingEntries) {
    steps.push(...entryWritingSteps(m.history));
    if (m.stashed.length)
      steps.push('The stashed entries below are included automatically: do not repeat them. If they already cover everything, pass --no-new-entries instead of --entry.');
  }
  if (!m.next)
    steps.push(`Choose the version bump. Current version: ${m.current}. major = breaking changes (use minor while the version is 0.x), minor = new features, patch = only fixes. Suggested: ${suggested} → ${bump(m.current, suggested)}.`);
  steps.push(approvalStep(ctx));

  const bumpArg = m.next ?? suggested;
  const entryArgs = m.missingEntries
    ? '--entry "<type>: <text>" --entry "<type>: <text>"'
    : m.given.map(entry => `--entry ${shellQuote(formatEntry(entry))}`).join(' ');
  const command = [BIN, 'release', 'start', bumpArg, entryArgs, ...passthroughFlags(ctx), ctx.config.confirmChangelog ? '--approved' : '']
    .filter(Boolean).join(' ');

  return new ActionRequired(
    !m.next && m.missingEntries ? 'Choose the version bump and write the changelog entries' : !m.next ? 'Choose the version bump' : 'Write the changelog entries',
    steps,
    [
      historySection(m.history),
      ...(m.stashed.length ? [entriesSection('Stashed entries (already included)', m.stashed)] : []),
      ...(m.given.length ? [entriesSection('Entries given', m.given)] : [])
    ],
    command,
    { currentVersion: m.current, suggestedBump: suggested, since: m.history.since, commits: m.history.commits, stashed: m.stashed }
  );
}

export async function releaseFinish(ctx: Ctx): Promise<Outcome> {
  const cfg = ctx.config;
  if (ctx.skipFlow) throw new CliError('`release finish` merges branches, so it cannot run with --sg or --sf.');
  const repo = requireRepo(ctx);
  validateFlowBranches(ctx);

  let releaseBranch: string;
  const head = requireBranch(ctx);
  if (branchKind(cfg, head) === 'release') {
    releaseBranch = head;
  } else if (ctx.args[0]) {
    releaseBranch = ctx.args[0].startsWith(cfg.releasePrefix) ? ctx.args[0] : `${cfg.releasePrefix}${clean(ctx.args[0])}`;
    if (!repo.localBranches.has(releaseBranch)) throw new CliError(`Branch ${releaseBranch} not found.`);
  } else {
    const candidates = [...repo.localBranches].filter(branch => branch.startsWith(cfg.releasePrefix));
    if (candidates.length !== 1)
      throw new CliError(candidates.length ? `Several releases in progress: ${candidates.join(', ')}.` : 'No release in progress.', candidates.length
        ? [`Check out the one to finish, or run \`${BIN} release finish <version>\`.`]
        : [`Start one with \`${BIN} release start\`.`]);
    releaseBranch = candidates[0];
  }

  const version = releaseBranch.slice(cfg.releasePrefix.length);
  await ensureClean(ctx);

  const tagName = cfg.tag ? `${cfg.tagPrefix}${version}` : null;
  const targets = [cfg.mainBranch, cfg.developBranch].filter(Boolean).join(' and ');
  if (ctx.interactive)
    await approve(ctx, `Finish release ${version}`, [
      `Merge ${releaseBranch} into ${targets}`,
      ...(tagName ? [`Tag ${tagName}`] : []),
      `Delete ${releaseBranch}`,
      cfg.push ? `Push to ${cfg.remote}` : 'Do not push'
    ]);

  const push = new PushPlan(ctx);
  await completeRelease(ctx, { source: releaseBranch, version, tagName, push, deleteSource: true });
  await push.run();

  return {
    summary: `Release ${version} finished`,
    details: [
      `Merged ${releaseBranch} into ${targets}`,
      ...(tagName ? [`Tagged ${tagName}`] : []),
      `Deleted ${releaseBranch}`,
      ...pushDetails(push),
      `Now on ${ctx.head}`
    ],
    next: [`Start the next piece of work with \`${BIN} feature start <name>\`.`],
    data: { version, tag: tagName, branch: ctx.head, pushed: push.pushed, pendingPush: push.pending }
  };
}
