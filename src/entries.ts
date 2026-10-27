import { ENTRY_TYPES, type Entry, type EntryType, formatEntry, TYPE_HELP } from './changelog';
import { formatHistory, type History } from './commits';
import { type Ctx, rerun } from './context';
import { confirm, input, select } from './prompt';
import { ActionRequired, bold, CliError, dim, type Section } from './ui';

/** Guidance for agents on how to write entries; shared by every "entries needed" message. */
export function entryWritingSteps(history: History | null): string[] {
  return [
    `Write the changelog entries yourself from the commits listed below${history?.since ? ` (since ${history.since})` : ''}. If a commit message is unclear, inspect it (git show <hash>). Ask the user only if you cannot work out what changed or whether it matters to users.`,
    'Write for the people who use the project: one change per entry, short, starting with a verb ("Add …", "Fix …"), no commit hashes. Leave out internal-only work (refactors, tests, CI, tooling) unless it affects users.',
    `Pick a type for each: ${ENTRY_TYPES.map(type => `${type} (${TYPE_HELP[type]})`).join(', ')}. Pass each one as --entry "<type>: <text>" (use single quotes if the text contains double quotes).`
  ];
}

export function approvalStep(ctx: Ctx): string {
  return ctx.config.confirmChangelog
    ? 'This project requires the user to approve agent-written changelog entries: show them the proposed entries (and version, if any) and wait for an explicit OK. Then run the command below with --approved.'
    : 'This project lets you write the entries without asking the user first (config.agent.confirmChangelog is false).';
}

export function historySection(history: History, title = 'Commits'): Section {
  return {
    title: history.since ? `${title} since ${history.since}` : title,
    lines: formatHistory(history)
  };
}

export function entriesSection(title: string, entries: Entry[]): Section {
  return { title, lines: entries.map(formatEntry) };
}

/**
 * Interactive loop: type → text → add another / done. With `ask`, first asks whether to add
 * entries at all, and allows finishing with none.
 */
export async function collectEntries(ctx: Ctx, history: History | null, ask?: { question: string; fallback: boolean }): Promise<Entry[]> {
  const optional = !!ask;
  if (history?.commits.length) {
    ctx.report.plain(bold(`\n${history.since ? `Commits since ${history.since}` : 'Commits'}:`));
    for (const line of formatHistory(history, 15)) ctx.report.plain(dim(`  ${line}`));
    ctx.report.plain();
  }
  if (ask && !(await confirm(ask.question, ask.fallback))) return [];

  const entries: Entry[] = [];
  for (;;) {
    const type = await select<EntryType>('What type of change?', ENTRY_TYPES.map(value => ({ label: value, hint: dim(TYPE_HELP[value]), value })));
    const value = (await input('Describe the change:')).trim();
    if (value) entries.push({ type, value });
    else ctx.report.warn('Empty entry ignored.');
    const next = await select('Next?', [
      { label: 'Add another change', value: 'add' },
      { label: 'Done', value: 'done' }
    ]);
    if (next === 'done' && (entries.length || optional)) return entries;
    if (next === 'done') ctx.report.warn('At least one entry is needed.');
  }
}

/**
 * Agent mode: when the project requires it, stops until the agent confirms (with --approved)
 * that the user approved the entries. Interactive mode: asks for a final confirmation.
 */
export async function approve(ctx: Ctx, heading: string, lines: string[]): Promise<void> {
  if (ctx.interactive) {
    ctx.report.plain(`\n${bold(heading)}`);
    for (const line of lines) ctx.report.plain(`  ${line}`);
    ctx.report.plain();
    if (!(await confirm('Proceed?', true))) throw new CliError('Cancelled. Nothing was changed.');
    return;
  }
  if (!ctx.config.confirmChangelog || ctx.flags.approved === true || ctx.dryRun) return;
  throw new ActionRequired('The user must approve these changelog entries', [
    'Show the user the proposal below exactly as written and ask them to approve it.',
    'If they want changes, adjust the version or the --entry values accordingly.',
    'Only after the user explicitly approves, run the command below (it adds --approved).'
  ], [{ title: heading, lines }], rerun(ctx, ['--approved']));
}
