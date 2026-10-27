#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { flagString, parseArgs } from './args';
import { renderMarkdown } from './changelog';
import { addEntries } from './commands/add';
import { featureFinish, featureStart } from './commands/feature';
import { init } from './commands/init';
import { pickCommand } from './commands/menu';
import { releaseFinish, releaseStart } from './commands/release';
import { commits, status } from './commands/status';
import { BIN, createContext, type Ctx, writeProjectFile } from './context';
import { guide } from './guide';
import { ActionRequired, CliError, type Outcome, printActionRequired, printError, printOutcome, setColor } from './ui';

const HELP = `changelog-flow (${BIN}): guided feature branches, changelog and releases.

Usage: ${BIN} [command] [options]       (no command: interactive menu, or status when not in a terminal)

Commands:
  status                  Branch, version, stashed entries, commits since the last release, next steps
  feature start <name>    Create ${'feature/'}<name> from the base branch (develop, or main in trunk mode)
  feature finish          Record changelog entries, merge the feature into the base branch, delete it
  add [entries…]          Stash changelog entries for the next release (alias: stash)
  release start [bump]    bump = patch | minor | major | x.y.z. Bumps the version, writes the changelog,
                          commits and opens release/<version> (or releases at once, see config)
  release finish          Merge the release into main (and develop), tag, push, delete the branch
  commits                 Commits since the last release, with suggested entry types (--since <ref>)
  md                      Rebuild CHANGELOG.md from changelog.json
  init                    Save the branching model and agent policy in changelog.json
  guide                   Instructions for AI agents (procedure, how to write entries)

Changelog entries:
  --entry "<type>: <text>"   Repeatable. Types: added, changed, deprecated, removed, fixed, security
  --added "<text>", --fixed "<text>", …   Shorthands
  --no-stashed               Leave stashed entries for a later release
  --no-new-entries           Release only the stashed entries
  --skip-entries             feature finish without entries
  --approved                 The user approved the agent-written entries (when config requires it)

Options:
  --message "<msg>"   Commit pending changes with this message before starting
  --dry-run, -n       Show what would happen; change nothing
  --no-push           Do everything locally (prints the push command to run later)
  --no-tag            Do not tag the release
  --no-ff             Always create merge commits
  --sf                No branching: commit (and tag) on the current branch
  --sg                No git at all: only update the files
  --main <branch>, --develop <branch>, --no-develop, --remote <name>, --no-release-branches
  --json              Machine-readable output (never prompts)
  --agent             Never prompt (automatic when stdin/stdout is not a terminal)
  --cwd <dir>         Project directory
  -h, --help          This help
  -v, --version       Tool version

Exit codes: 0 done · 1 error · 2 action required (instructions printed)
Legacy flags still work: --action=<stash|newFeature|closeFeature|newRelease|closeRelease|md>, --p, --f, --m, --noTag.
`;

const LEGACY_ACTIONS: Record<string, string[]> = {
  stash: ['add'],
  newfeature: ['feature', 'start'],
  closefeature: ['feature', 'finish'],
  newrelease: ['release', 'start'],
  closerelease: ['release', 'finish'],
  md: ['md']
};

const ALIASES: Record<string, string> = {
  stash: 'add', log: 'add', entries: 'add', st: 'status', changelog: 'md', commit: 'commits', help: 'help'
};

const SUBCOMMANDS: Record<string, Record<string, string>> = {
  feature: { start: 'start', new: 'start', create: 'start', begin: 'start', finish: 'finish', close: 'finish', end: 'finish', done: 'finish', merge: 'finish' },
  release: { start: 'start', new: 'start', create: 'start', open: 'start', finish: 'finish', close: 'finish', end: 'finish', done: 'finish' }
};

type Handler = (ctx: Ctx) => Promise<Outcome>;

const HANDLERS: Record<string, Handler> = {
  'status': status,
  'commits': commits,
  'add': addEntries,
  'feature start': featureStart,
  'feature finish': featureFinish,
  'release start': releaseStart,
  'release finish': releaseFinish,
  'init': init,
  'md': async ctx => {
    if (!ctx.data) throw new CliError('changelog.json not found.', [`Create it with \`${BIN} init\` or \`${BIN} release start\`.`]);
    if (!ctx.config.markdownFile) throw new CliError('Markdown output is disabled (config.markdownFile is false).');
    writeProjectFile(ctx, ctx.config.markdownFile, renderMarkdown(ctx.data));
    return { summary: `${ctx.config.markdownFile} rebuilt`, data: { file: ctx.config.markdownFile } };
  },
  'guide': async ctx => {
    const text = guide(ctx);
    if (!ctx.json) process.stdout.write(text);
    return { summary: 'Guide', data: { guide: text }, printed: true };
  }
};

function toolVersion(): string {
  try {
    return JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
  } catch {
    return 'unknown';
  }
}

/** Resolves "<command> [subcommand]" and returns it with the remaining positionals. */
function resolveCommand(positionals: string[], action: string | undefined): { command: string | null; args: string[] } {
  if (action) {
    const mapped = LEGACY_ACTIONS[action.toLowerCase()];
    if (!mapped) throw new CliError(`Unknown --action "${action}".`, [`Use one of: ${Object.keys(LEGACY_ACTIONS).join(', ')}.`]);
    return { command: mapped.join(' '), args: positionals };
  }
  const [first, second, ...rest] = positionals;
  if (!first) return { command: null, args: [] };
  const name = ALIASES[first] ?? first;
  const subs = SUBCOMMANDS[name];
  if (subs) {
    const sub = second ? subs[second] : undefined;
    if (!sub) throw new CliError(`Usage: ${BIN} ${name} <start|finish>`, [`Run \`${BIN} status\` to see what to do next.`]);
    return { command: `${name} ${sub}`, args: rest };
  }
  if (!HANDLERS[name] && name !== 'help') throw new CliError(`Unknown command "${first}".`, [`Run \`${BIN} --help\` for the list of commands.`]);
  return { command: name, args: [second, ...rest].filter((arg): arg is string => arg !== undefined) };
}

async function main(argv: string[]): Promise<number> {
  let json = argv.includes('--json');
  if (json) setColor(false);
  try {
    const { positionals, flags } = parseArgs(argv);
    json = flags.json === true;
    if (flags.help === true || positionals[0] === 'help') {
      process.stdout.write(HELP);
      return 0;
    }
    if (flags.version === true) {
      process.stdout.write(`${toolVersion()}\n`);
      return 0;
    }

    const resolved = resolveCommand(positionals, flagString(flags, 'action'));
    const ctx = await createContext(argv, flags, resolved.args);
    let command = resolved.command;
    if (!command) {
      if (!ctx.interactive) command = 'status';
      else {
        const picked = await pickCommand(ctx);
        command = picked.join(' ');
      }
    }
    printOutcome(await HANDLERS[command](ctx), json);
    return 0;
  } catch (error) {
    if (error instanceof ActionRequired) {
      printActionRequired(error, json);
      return 2;
    }
    if (error instanceof CliError) {
      printError(error, json);
      return 1;
    }
    printError(new CliError(`Unexpected error: ${error instanceof Error ? error.stack ?? error.message : String(error)}`), json);
    return 1;
  }
}

main(process.argv.slice(2)).then(code => {
  process.exitCode = code;
});
