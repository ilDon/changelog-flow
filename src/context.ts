import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type Flags, flagString } from './args';
import { CHANGELOG_JSON, type ChangelogData, defaultData, loadChangelog, renderMarkdown, serialize } from './changelog';
import { type Config, resolveConfig } from './config';
import { applyEol, detectEol, type Eol } from './eol';
import { Git, readRepoState, type RepoState } from './git';
import { CliError, Reporter, shellQuote } from './ui';
import { currentVersion, type CurrentVersion } from './version';

export const BIN = 'cglg';

export interface Ctx {
  /** Raw CLI arguments, used to build "re-run" suggestions. */
  argv: string[];
  /** Positional arguments after the command/subcommand. */
  args: string[];
  flags: Flags;
  cwd: string;
  interactive: boolean;
  json: boolean;
  dryRun: boolean;
  skipGit: boolean;
  skipFlow: boolean;
  report: Reporter;
  git: Git;
  repo: RepoState | null;
  /** Branch currently checked out; kept up to date by our own checkouts. */
  head: string | null;
  changelogPath: string;
  data: ChangelogData | null;
  config: Config;
  /** Line ending used by the project's existing files (for files we create). */
  eol?: Eol;
}

export async function createContext(argv: string[], flags: Flags, args: string[]): Promise<Ctx> {
  const cwd = resolve(flagString(flags, 'cwd') ?? process.cwd());
  if (!existsSync(cwd)) throw new CliError(`Directory not found: ${cwd}`);

  const json = flags.json === true;
  const interactive = !json && flags.agent !== true && flags.input !== false && !process.env.CGLG_AGENT &&
    !!process.stdin.isTTY && !!process.stdout.isTTY;
  const dryRun = flags['dry-run'] === true;
  const skipGit = flags.sg === true || flags['skip-git'] === true;
  const skipFlow = skipGit || flags.sf === true || flags['skip-flow'] === true;

  const report = new Reporter(json);
  const git = new Git(cwd, report, dryRun, interactive);
  const repoState = skipGit ? Promise.resolve(null) : readRepoState(git);
  const changelogPath = join(cwd, CHANGELOG_JSON);
  const data = loadChangelog(changelogPath);
  const repo = await repoState;

  return {
    argv, args, flags, cwd, interactive, json, dryRun, skipGit, skipFlow, report, git, repo,
    head: repo?.branch ?? null,
    changelogPath,
    data,
    config: resolveConfig(data?.config, repo, flags, cwd)
  };
}

function readIfExists(path: string): string | null {
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

/** Line ending of the project's own files, so new files match them. LF when nothing tells otherwise. */
function projectEol(ctx: Ctx): Eol {
  if (!ctx.eol) {
    const candidates = [CHANGELOG_JSON, 'package.json', ctx.config.markdownFile].filter((file): file is string => !!file);
    ctx.eol = '\n';
    for (const file of candidates) {
      const eol = detectEol(readIfExists(join(ctx.cwd, file)) ?? '');
      if (eol) {
        ctx.eol = eol;
        break;
      }
    }
  }
  return ctx.eol;
}

/**
 * Writes a project file keeping the line endings it already has (CRLF stays CRLF, LF stays LF),
 * so releases made on Windows and macOS/Linux never rewrite whole files. New files follow the project.
 */
export function writeProjectFile(ctx: Ctx, file: string, contents: string): void {
  ctx.report.step(`${ctx.dryRun ? '[dry-run] would write' : 'Writing'} ${file}`);
  if (ctx.dryRun) return;
  const path = join(ctx.cwd, file);
  const eol = detectEol(readIfExists(path) ?? '') ?? projectEol(ctx);
  writeFileSync(path, applyEol(contents, eol));
}

export function getData(ctx: Ctx): ChangelogData {
  ctx.data ??= defaultData();
  return ctx.data;
}

/** Saves changelog.json (and CHANGELOG.md when `markdown` is true). Returns the written files. */
export function saveData(ctx: Ctx, markdown: boolean): string[] {
  const data = getData(ctx);
  writeProjectFile(ctx, CHANGELOG_JSON, serialize(data));
  const files = [CHANGELOG_JSON];
  if (markdown && ctx.config.markdownFile) {
    writeProjectFile(ctx, ctx.config.markdownFile, renderMarkdown(data));
    files.push(ctx.config.markdownFile);
  }
  return files;
}

export function versionOf(ctx: Ctx): CurrentVersion {
  return currentVersion(ctx.cwd, ctx.config.versionFiles, ctx.data);
}

/** The exact command the user ran, with extra arguments appended (for "re-run with ..." hints). */
export function rerun(ctx: Ctx, extra: string[] = []): string {
  const args = [...ctx.argv.filter(arg => !extra.includes(arg)), ...extra];
  return [BIN, ...args.map(shellQuote)].join(' ');
}

const PASSTHROUGH_BOOLEANS = new Set(['--dry-run', '-n', '--no-push', '--no-tag', '--noTag', '--sf', '--sg', '--skip-flow', '--skip-git', '--no-stashed', '--no-ff', '--json', '--force']);
const PASSTHROUGH_VALUES = new Set(['--cwd', '--remote', '--main', '--develop']);

/** Global options from the original command line, to carry over into suggested commands. */
export function passthroughFlags(ctx: Ctx): string[] {
  const out: string[] = [];
  for (let i = 0; i < ctx.argv.length; i++) {
    const arg = ctx.argv[i];
    const key = arg.split('=')[0];
    if (PASSTHROUGH_BOOLEANS.has(arg) || (arg.includes('=') && PASSTHROUGH_VALUES.has(key))) out.push(shellQuote(arg));
    else if (PASSTHROUGH_VALUES.has(arg) && ctx.argv[i + 1] !== undefined) out.push(arg, shellQuote(ctx.argv[++i]));
  }
  return out;
}
