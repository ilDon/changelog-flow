import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { flagList } from '../args';
import { CHANGELOG_JSON, type ChangelogData } from '../changelog';
import { describeFlow, type FileConfig, resolveConfig } from '../config';
import { BIN, type Ctx, getData, saveData, writeProjectFile } from '../context';
import { branchExists, commitFiles } from '../flow';
import { AGENTS_POINTER } from '../guide';
import { confirm, input, select } from '../prompt';
import type { Outcome } from '../ui';

const AGENT_FILES = ['AGENTS.md', 'CLAUDE.md'];

/** Puts `config` right after title/description so it is easy to find. */
function withConfig(data: ChangelogData, config: FileConfig): ChangelogData {
  const { title, description, config: _old, ...rest } = data;
  return { title, description, config, ...rest } as ChangelogData;
}

export async function init(ctx: Ctx): Promise<Outcome> {
  const detected = ctx.config;
  const existing: FileConfig = ctx.data?.config ?? {};
  const flagConfirm = typeof ctx.flags['confirm-changelog'] === 'boolean' ? ctx.flags['confirm-changelog'] as boolean : undefined;
  let config: FileConfig;
  let agentFiles: string[];

  if (ctx.interactive) {
    const gitflow = await select('Branching model?', [
      { label: 'GitFlow', hint: `features from develop; releases merged into ${detected.mainBranch} and develop`, value: true },
      { label: 'Trunk', hint: `features and releases branch from and merge into ${detected.mainBranch}`, value: false }
    ], detected.developBranch ? 0 : 1);
    const mainBranch = await input('Main branch:', detected.mainBranch);
    const developBranch = gitflow ? await input('Develop branch:', detected.developBranch ?? 'develop') : null;
    const releaseBranches = await select('`release start` should…', [
      { label: 'Open a release/<version> branch', hint: 'finish later with `cglg release finish`', value: true },
      { label: 'Release immediately', hint: 'bump, commit, tag and push in one step', value: false }
    ], detected.releaseBranches ? 0 : 1);
    const tag = await confirm(`Tag releases as ${detected.tagPrefix}<version>?`, detected.tag);
    const confirmChangelog = await select('When an AI agent writes changelog entries…', [
      { label: 'It must ask the user to approve them first', value: true },
      { label: 'It can proceed without asking', value: false }
    ], detected.confirmChangelog ? 0 : 1);
    config = { ...existing, mainBranch, developBranch, releaseBranches, tag, agent: { ...existing.agent, confirmChangelog } };

    const candidates = AGENT_FILES.filter(file => existsSync(join(ctx.cwd, file)));
    const target = candidates.length ? candidates.join(' and ') : 'AGENTS.md';
    agentFiles = ctx.flags['agents-file'] === false ? [] : flagList(ctx.flags, 'agents-file').length ? flagList(ctx.flags, 'agents-file')
      : await confirm(`Add a short changelog-flow note for AI agents to ${target}?`, true) ? (candidates.length ? candidates : ['AGENTS.md']) : [];
  } else {
    config = {
      ...existing,
      mainBranch: detected.mainBranch,
      developBranch: detected.developBranch,
      releaseBranches: detected.releaseBranches,
      tag: detected.tag,
      agent: { ...existing.agent, confirmChangelog: flagConfirm ?? detected.confirmChangelog }
    };
    agentFiles = ctx.flags['agents-file'] === false ? [] : flagList(ctx.flags, 'agents-file').length
      ? flagList(ctx.flags, 'agents-file')
      : AGENT_FILES.filter(file => existsSync(join(ctx.cwd, file)));
  }

  ctx.data = withConfig(getData(ctx), config);
  ctx.config = resolveConfig(config, ctx.repo, ctx.flags, ctx.cwd);
  const files = saveData(ctx, false);
  const details = [`${CHANGELOG_JSON}: ${describeFlow(ctx.config)}`];

  for (const file of agentFiles) {
    const path = join(ctx.cwd, file);
    const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
    if (current.includes(`${BIN} guide`)) continue;
    writeProjectFile(ctx, file, `${current}${current && !current.endsWith('\n\n') ? (current.endsWith('\n') ? '\n' : '\n\n') : ''}${AGENTS_POINTER}`);
    files.push(file);
    details.push(`${file}: added a note pointing agents to \`${BIN} guide\``);
  }

  const develop = ctx.config.developBranch;
  if (develop && ctx.repo && !branchExists(ctx, develop) && branchExists(ctx, ctx.config.mainBranch)) {
    await ctx.git.exec(['branch', develop, ctx.config.mainBranch]);
    ctx.repo.localBranches.add(develop);
    details.push(`Created ${develop} from ${ctx.config.mainBranch}`);
  }

  if (ctx.repo && ctx.flags.commit !== false) await commitFiles(ctx, files, 'chore(changelog): configure changelog-flow');

  return {
    summary: 'changelog-flow configured',
    details,
    next: [
      'Fine-tune any setting in the "config" section of changelog.json (see the README for every option).',
      ...(agentFiles.length ? [] : [`Tell agents about the tool: add this to AGENTS.md or CLAUDE.md:\n${AGENTS_POINTER.trimEnd().split('\n').map(line => `      ${line}`).join('\n')}`])
    ],
    data: { config, files }
  };
}
