import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { type Flags, flagString } from './args';
import type { RepoState } from './git';

/** The `config` object stored in changelog.json. Every key is optional. */
export interface FileConfig {
  /** Branch that receives releases. Default: auto-detected (main, master, remote HEAD). */
  mainBranch?: string;
  /** Integration branch for features (GitFlow). `null` = work directly on mainBranch. Default: "develop" if it exists. */
  developBranch?: string | null | false;
  featurePrefix?: string;
  releasePrefix?: string;
  /** Create a release/<version> branch on `release start` (true), or release directly (false). */
  releaseBranches?: boolean;
  tag?: boolean;
  tagPrefix?: string;
  remote?: string;
  push?: boolean;
  /** Always create merge commits (git merge --no-ff). */
  noFastForward?: boolean;
  /** JSON files whose top-level "version" is bumped. Default: ["package.json"] if present. */
  versionFiles?: string[];
  /** Markdown output, or false to disable. Default: "CHANGELOG.md". */
  markdownFile?: string | false;
  agent?: {
    /** When an agent writes changelog entries, it must get the user's approval first. Default: true. */
    confirmChangelog?: boolean;
  };
}

export interface Config {
  mainBranch: string;
  developBranch: string | null;
  featurePrefix: string;
  releasePrefix: string;
  releaseBranches: boolean;
  tag: boolean;
  tagPrefix: string;
  remote: string;
  push: boolean;
  noFastForward: boolean;
  versionFiles: string[];
  markdownFile: string | null;
  confirmChangelog: boolean;
}

function exists(repo: RepoState | null, remote: string, name: string): boolean {
  return !!repo && (repo.localBranches.has(name) || repo.remoteBranches.has(`${remote}/${name}`));
}

function detectMain(repo: RepoState | null, remote: string): string {
  for (const name of ['main', 'master']) if (exists(repo, remote, name)) return name;
  const head = repo?.remoteHeads.get(remote);
  if (head && head !== 'develop') return head;
  if (repo?.branch && !repo.branch.includes('/') && repo.branch !== 'develop') return repo.branch;
  return 'main';
}

export function resolveConfig(file: FileConfig | undefined, repo: RepoState | null, flags: Flags, cwd: string): Config {
  const f = file ?? {};
  const remote = flagString(flags, 'remote') ?? f.remote ?? 'origin';
  const mainBranch = flagString(flags, 'main') ?? f.mainBranch ?? detectMain(repo, remote);

  let developBranch: string | null;
  if (flags.develop === false) developBranch = null;
  else if (typeof flags.develop === 'string') developBranch = flags.develop;
  else if (f.developBranch === null || f.developBranch === false) developBranch = null;
  else if (typeof f.developBranch === 'string') developBranch = f.developBranch;
  else developBranch = exists(repo, remote, 'develop') ? 'develop' : null;
  if (developBranch === mainBranch) developBranch = null;

  const bool = (flag: string, value: boolean | undefined, fallback: boolean): boolean =>
    typeof flags[flag] === 'boolean' ? flags[flag] as boolean : value ?? fallback;

  return {
    mainBranch,
    developBranch,
    featurePrefix: f.featurePrefix ?? 'feature/',
    releasePrefix: f.releasePrefix ?? 'release/',
    releaseBranches: bool('release-branches', f.releaseBranches, true),
    tag: bool('tag', f.tag, true),
    tagPrefix: f.tagPrefix ?? 'v',
    remote,
    push: bool('push', f.push, true),
    noFastForward: typeof flags.ff === 'boolean' ? !flags.ff : f.noFastForward ?? false,
    versionFiles: f.versionFiles ?? (existsSync(join(cwd, 'package.json')) ? ['package.json'] : []),
    markdownFile: f.markdownFile === false ? null : f.markdownFile ?? 'CHANGELOG.md',
    confirmChangelog: f.agent?.confirmChangelog ?? true
  };
}

/** Describes the branching model in one line. */
export function describeFlow(cfg: Config): string {
  const releases = cfg.releaseBranches ? `release branches ${cfg.releasePrefix}<version>` : 'no release branches';
  if (cfg.developBranch)
    return `GitFlow: features from ${cfg.developBranch}, releases into ${cfg.mainBranch} and ${cfg.developBranch} (${releases})`;
  return `Trunk: features and releases from/into ${cfg.mainBranch} (${releases})`;
}
