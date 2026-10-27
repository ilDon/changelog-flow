import type { Ctx } from '../context';
import { baseBranch, branchKind } from '../flow';
import { type Choice, select } from '../prompt';

/** Interactive entry point: lists the actions, the most likely one first. */
export async function pickCommand(ctx: Ctx): Promise<string[]> {
  const cfg = ctx.config;
  const kind = ctx.head ? branchKind(cfg, ctx.head) : null;
  const base = baseBranch(cfg);
  const releasing = [...(ctx.repo?.localBranches ?? [])].some(branch => branch.startsWith(cfg.releasePrefix));

  const choices: Array<Choice<string[]> & { first?: boolean }> = [
    { label: `Finish feature ${kind === 'feature' ? ctx.head : ''}`.trim(), hint: `merge into ${base}`, value: ['feature', 'finish'], first: kind === 'feature' },
    { label: 'Finish release', hint: `merge into ${[cfg.mainBranch, cfg.developBranch].filter(Boolean).join(' and ')}, tag, push`, value: ['release', 'finish'], first: kind === 'release' },
    { label: 'Start a release', hint: 'bump version and write the changelog', value: ['release', 'start'] },
    { label: 'Start a new feature', hint: `branch from ${base}`, value: ['feature', 'start'] },
    { label: 'Stash changelog entries', hint: 'for the next release', value: ['add'] },
    { label: 'Show status', value: ['status'] },
    { label: 'Rebuild CHANGELOG.md', value: ['md'] },
    { label: 'Configure', hint: 'branching model and agent policy', value: ['init'] }
  ].filter(choice => {
    if (choice.value.join(' ') === 'feature finish') return kind === 'feature';
    if (choice.value.join(' ') === 'release finish') return kind === 'release' || releasing;
    if (choice.value.join(' ') === 'release start') return kind !== 'release';
    return true;
  });
  choices.sort((a, b) => Number(!!b.first) - Number(!!a.first));
  return select('What do you want to do?', choices);
}
