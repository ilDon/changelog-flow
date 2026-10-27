import { ENTRY_TYPES, TYPE_HELP } from './changelog';
import { describeFlow } from './config';
import { BIN, type Ctx } from './context';
import { baseBranch } from './flow';

/** One-paragraph pointer for AGENTS.md / CLAUDE.md. The full guide stays in the tool, so it is always current. */
export const AGENTS_POINTER = `## Releases and changelog

This project uses [changelog-flow](https://github.com/ilDon/changelog-flow) (\`${BIN}\`) for feature branches, the changelog and releases. Before starting or finishing a feature, recording changelog entries or making a release, run \`${BIN} guide\` and follow it. Never bump the version, edit changelog.json / CHANGELOG.md, or create release branches and tags by hand.
`;

export function guide(ctx: Ctx): string {
  const cfg = ctx.config;
  const base = baseBranch(cfg);
  const approval = cfg.confirmChangelog
    ? `**Ask first.** This project requires the user's approval of every changelog entry you write. Before running a command with entries, show the user the proposed version and entries and wait for an explicit OK, then add \`--approved\`. If you forget, ${BIN} stops and asks you to do it.`
    : '**No approval needed.** This project lets you write changelog entries without asking the user first (but ask when you cannot tell what changed).';

  return `# changelog-flow: instructions for agents

\`${BIN}\` runs the release procedure of this project and makes its steps mandatory. Use it instead of doing these steps by hand: never edit the version, changelog.json or CHANGELOG.md yourself, and never create release branches or tags manually.

## This project
- Branching: ${describeFlow(cfg)}.
- Features: \`${cfg.featurePrefix}<name>\` branches from \`${base}\`, merged back into \`${base}\`.
- Releases: ${cfg.releaseBranches ? `\`${BIN} release start\` opens \`${cfg.releasePrefix}<version>\`; \`${BIN} release finish\` merges it into \`${cfg.mainBranch}\`${cfg.developBranch ? ` and \`${cfg.developBranch}\`` : ''}` : `\`${BIN} release start\` bumps, commits${cfg.developBranch ? `, merges into \`${cfg.mainBranch}\`` : ''} and tags in one step`}${cfg.tag ? `, tagged \`${cfg.tagPrefix}<version>\`` : ''}.
- Push: ${cfg.push ? `to \`${cfg.remote}\`, in one atomic push at the end of each command` : 'disabled (commands print the push command to run later)'}.
- Changelog approval: ${cfg.confirmChangelog ? 'the user must approve entries you write' : 'not required'}.

## How ${BIN} talks to you
- It never prompts when run by an agent. Exit code 0 = done, 1 = error (read the message and hints), 2 = ACTION REQUIRED: it prints what to do and the exact command to run next. Follow it.
- \`${BIN} status\` shows the current branch, version, stashed entries, commits since the last release and the next steps. Start there when unsure.
- Add \`--dry-run\` to see the git commands without changing anything, \`--json\` for machine-readable output.
- Uncommitted changes block every command. Commit them yourself with a meaningful message, or pass \`--message "<msg>"\`.

## Writing changelog entries
When ${BIN} asks for entries, **you write them**: do not ask the user to dictate them.
1. Read the commits ${BIN} lists (or \`${BIN} commits\`, which includes commit bodies). When a message is vague, look at the change (\`git show <hash>\`).
2. Write for the project's users: one change per entry, short, starting with a verb ("Add …", "Fix …"), no commit hashes. Leave out refactors, tests, CI and tooling unless they affect users. Merge related commits into one entry.
3. Types: ${ENTRY_TYPES.map(type => `\`${type}\` (${TYPE_HELP[type]})`).join(', ')}.
4. Pass each entry as \`--entry "<type>: <text>"\` (repeatable; use single quotes if the text contains double quotes).
5. Stashed entries are included in the release automatically: do not repeat them.
6. If you cannot work out what changed or whether it matters to users, ask the user.

${approval}

## Choosing the version bump
- \`major\`: breaking changes (removed or incompatible behaviour). While the version is 0.x, use \`minor\` instead.
- \`minor\`: new features.
- \`patch\`: fixes and small improvements only.
${BIN} suggests a bump from the commits; state your choice when you ask for approval.

## Procedures
- Start a feature: \`${BIN} feature start <short-name>\`
- Finish a feature: \`${BIN} feature finish --entry "added: …"\` (or \`--skip-entries\` if nothing user-facing changed). Entries are stashed for the next release.
- Stash entries without finishing: \`${BIN} add --entry "fixed: …"\`
- Release: \`${BIN} release start <patch|minor|major> --entry "…"\`${cfg.releaseBranches ? `, then build/test/publish as the project requires, then \`${BIN} release finish\`` : ''}.
- If a step fails (merge conflict, rejected push), nothing is left half done: follow the hints in the message. They say whether to run the same command again (\`${BIN} release finish\` skips the steps already completed) or which command finishes the job.
`;
}
