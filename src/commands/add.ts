import { entriesFromFlags, formatEntry } from '../changelog';
import { commitsInRange, commitsSinceRelease } from '../commits';
import { BIN, type Ctx, getData, saveData } from '../context';
import { approvalStep, approve, collectEntries, entriesSection, entryWritingSteps, historySection } from '../entries';
import { baseBranch, branchKind, commitFiles, refFor } from '../flow';
import { ActionRequired, type Outcome } from '../ui';

/** Stashes changelog entries in changelog.json ("temp"); the next release picks them up. */
export async function addEntries(ctx: Ctx): Promise<Outcome> {
  let entries = entriesFromFlags(ctx.flags, ctx.args);
  const stashed = ctx.data?.temp ?? [];
  const onFeature = !!ctx.head && branchKind(ctx.config, ctx.head) === 'feature';
  const history = onFeature
    ? await commitsInRange(ctx, refFor(ctx, baseBranch(ctx.config)))
    : await commitsSinceRelease(ctx);

  if (!entries.length) {
    if (ctx.interactive) {
      entries = await collectEntries(ctx, history);
    } else {
      throw new ActionRequired('Write the changelog entries to stash', [
        ...entryWritingSteps(history),
        ...(stashed.length ? ['Entries already stashed are listed below: do not add them again.'] : []),
        approvalStep(ctx)
      ], [
        historySection(history, onFeature ? `Commits in ${ctx.head}` : 'Commits'),
        ...(stashed.length ? [entriesSection('Already stashed', stashed)] : [])
      ], `${BIN} add --entry "<type>: <text>"${ctx.config.confirmChangelog ? ' --approved' : ''}`);
    }
  }
  if (!ctx.interactive) await approve(ctx, 'Changelog entries to stash', entries.map(formatEntry));

  const data = getData(ctx);
  data.temp = [...(data.temp ?? []), ...entries];
  const files = saveData(ctx, false);
  if (ctx.flags.commit !== false)
    await commitFiles(ctx, files, `chore(changelog): stash ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`);

  return {
    summary: `Stashed ${entries.length} changelog entr${entries.length === 1 ? 'y' : 'ies'} (${data.temp.length} waiting for the next release)`,
    details: entries.map(formatEntry),
    next: [`They are included automatically by \`${BIN} release start\`.`],
    data: { added: entries, stashed: data.temp }
  };
}
