# `changelog-flow`

A CLI that turns releasing into a procedure: feature and release branches, [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and a [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) `CHANGELOG.md`, with no step left to memory.

- **Zero dependencies.** One self-contained file; runs on Node.js ≥ 18 and Bun.
- **Fast.** Reads the repository with three local git calls, never touches the network until the end, and pushes everything (branches, tag, deleted branches) in a single atomic `git push`.
- **Flexible.** GitFlow (`develop` + `main`/`master`) or trunk-based (everything on `main`/`master`), with or without release branches. Auto-detected, configurable.
- **Built for AI agents too.** It never prompts when it isn't run in a terminal. When it needs something (changelog entries, a version bump, the user's approval) it stops with exit code 2 and tells the agent exactly what to do and which command to run next.

## Installation

    npm i -g changelog-flow

This installs the `cglg` command (also available as `changelog-flow`). It needs the `git` CLI, unless you only manage files with `--sg`.

## Quick start

    cglg                          # interactive menu (in a terminal); status otherwise
    cglg status                   # where am I, what changed since the last release, what next
    cglg feature start login-form
    # …commit work…
    cglg feature finish           # asks for changelog entries, merges, deletes the branch
    cglg release start minor      # bumps the version, writes the changelog, opens release/x.y.z
    # …build, test, publish…
    cglg release finish           # merges into main (and develop), tags, pushes

Everything you can answer interactively can also be passed as an option, so every command can run unattended:

    cglg release start minor --entry "added: CSV export" --entry "fixed: Crash on empty rows"

## Branching models

`changelog-flow` detects the model from your branches (or reads it from the [config](#configuration)):

| | GitFlow (a `develop` branch exists) | Trunk (only `main`/`master`) |
|---|---|---|
| `feature start` | `feature/<name>` from `develop` | `feature/<name>` from `main` |
| `feature finish` | merge into `develop` | merge into `main` |
| `release start` | `release/<version>` from `develop` | `release/<version>` from `main` |
| `release finish` | merge into `main` and `develop`, tag | merge into `main`, tag |

With `"releaseBranches": false`, `release start` releases immediately: it commits the new version and tags it on `main` (in GitFlow it first merges `develop` into `main`). With `--sf` it commits and tags on whatever branch you are on, without touching any other branch.

If `release start` runs on a feature branch, the feature is merged into the base branch first.

## Commands

| Command | What it does |
|---|---|
| `cglg status` | Branching model, branch, version, stashed entries, commits since the last release and the next steps. `--json` for scripts. |
| `cglg feature start <name>` | Creates `feature/<name>` from the base branch. Uncommitted changes on the base branch move to the new branch. `--push` to push it. |
| `cglg feature finish [name]` | Asks for changelog entries (stashed for the next release; `--skip-entries` to skip), merges into the base branch, deletes the branch locally and remotely, pushes the base branch. |
| `cglg add [entries…]` | Stashes changelog entries for the next release (alias `stash`). Commits only `changelog.json`. |
| `cglg release start [patch\|minor\|major\|x.y.z]` | Bumps the version in `package.json` (and `package-lock.json`), adds the release to `changelog.json` with the stashed and new entries, renders `CHANGELOG.md`, commits `Version x.y.z`, opens the release branch (or releases directly) and pushes. |
| `cglg release finish [version]` | Merges the release branch into `main` (and `develop`), tags `vX.Y.Z`, deletes the branch, pushes everything at once. Conflicts are detected before anything changes, and if you resolve one by hand, running it again skips the steps already done. |
| `cglg commits` | Commits since the last release, with their bodies and a suggested entry type (from [Conventional Commits](https://www.conventionalcommits.org) or the first word). `--since <ref>` for another range. |
| `cglg md` | Rebuilds `CHANGELOG.md` from `changelog.json`. |
| `cglg init` | Saves the branching model and agent policy in `changelog.json` (and can add a short note to `AGENTS.md`/`CLAUDE.md`). |
| `cglg guide` | Prints the instructions for AI agents, tailored to the project's configuration. |

Before starting, every command refuses to run with uncommitted changes. In a terminal it offers to commit them; otherwise pass `--message "<commit message>"` or commit them yourself.

### Changelog entries

Each entry has a type: `added`, `changed`, `deprecated`, `removed`, `fixed` or `security` (aliases like `feat` and `fix` work too).

    --entry "fixed: Crash when the list is empty"   # repeatable
    --fixed "Crash when the list is empty"          # shorthand, one per type
    cglg add "added: Dark mode" "fixed: Typo"       # positional, for `add`

Entries stashed with `add` or `feature finish` are included in the next `release start` (`--no-stashed` keeps them for later; `--no-new-entries` releases only the stashed ones).

### Options

| Option | |
|---|---|
| `--message "<msg>"` | Commit pending changes with this message first |
| `--dry-run`, `-n` | Print the git commands and file writes without doing them |
| `--no-push` | Work locally; the output shows the `git push` to run later |
| `--no-tag` | Don't tag the release |
| `--no-ff` | Always create merge commits |
| `--sf` | Skip branching: commit (and tag) on the current branch |
| `--sg` | Skip git entirely: only update the files (works without a repository and without `package.json`) |
| `--main <b>`, `--develop <b>`, `--no-develop`, `--remote <r>`, `--no-release-branches` | Override the configuration for one run |
| `--approved` | The user approved the agent-written entries (see below) |
| `--json` | Machine-readable output; never prompts |
| `--agent` | Never prompt, even in a terminal (also `CGLG_AGENT=1`) |
| `--cwd <dir>` | Project directory |

Exit codes: `0` done, `1` error (with hints), `2` action required (with instructions).

## Using it with AI agents

Agents run `cglg` like any other command. Because their shell is not a terminal, `cglg` never waits for input: if something is missing it exits with code `2` and prints **ACTION REQUIRED**, what to do, and the exact command to run next. For example, `cglg release start` with nothing else:

```
⚠ ACTION REQUIRED: Choose the version bump and write the changelog entries

What to do:
  1. Write the changelog entries yourself from the commits listed below (since v1.4.2). …
  2. Write for the people who use the project: one change per entry, short, …
  3. Pick a type for each: added (new features), changed (…), … Pass each one as --entry "<type>: <text>" …
  4. Choose the version bump. Current version: 1.4.2. … Suggested: minor → 1.5.0.
  5. This project requires the user to approve agent-written changelog entries: …

Commits since v1.4.2:
  edf4924 refactor parser  [internal]
  888f4ff fix: handle empty rows  [suggested: fixed]
  2f9e93d feat(export): add CSV export  [suggested: added]

Then run:
  cglg release start minor --entry "<type>: <text>" --entry "<type>: <text>" --approved
```

So the agent works out the changelog from the commits itself, and asks the user only when it can't tell what changed.

### Approval policy

Whether the agent must show its entries to the user before writing them is a per-project setting:

```json
"config": { "agent": { "confirmChangelog": true } }
```

- `true` (default): when an agent passes entries without `--approved`, `cglg` stops, prints the exact proposal (version, entries, branches) and tells the agent to get the user's OK and re-run with `--approved`.
- `false`: the agent proceeds silently.

### Telling agents about the tool

`cglg init` can add this note to `AGENTS.md` / `CLAUDE.md`, so agents know to use the tool:

> This project uses changelog-flow (`cglg`) for feature branches, the changelog and releases. Before starting or finishing a feature, recording changelog entries or making a release, run `cglg guide` and follow it. …

`cglg guide` prints the full, always-current procedure for the project's configuration.

## Configuration

Settings live in the `config` section of `changelog.json`. All keys are optional; anything missing is auto-detected or uses the default.

```json
{
  "title": "Changelog",
  "description": "…",
  "config": {
    "mainBranch": "main",
    "developBranch": null,
    "releaseBranches": true,
    "agent": { "confirmChangelog": true }
  },
  "temp": [],
  "changes": []
}
```

| Key | Default | |
|---|---|---|
| `mainBranch` | `main` or `master`, whichever exists | Branch that receives releases |
| `developBranch` | `"develop"` if it exists, else `null` | Integration branch (GitFlow). `null` = trunk mode |
| `releaseBranches` | `true` | `false` = `release start` releases immediately |
| `featurePrefix` / `releasePrefix` | `"feature/"` / `"release/"` | Branch name prefixes |
| `tag` / `tagPrefix` | `true` / `"v"` | Tag releases as `v1.2.3` |
| `remote` / `push` | `"origin"` / `true` | Where and whether to push |
| `noFastForward` | `false` | Always create merge commits |
| `versionFiles` | `["package.json"]` if present | JSON files whose top-level `version` is bumped (formatting is preserved; `package-lock.json` follows `package.json`). Empty = the version lives only in `changelog.json` |
| `markdownFile` | `"CHANGELOG.md"` | `false` disables the markdown file |
| `agent.confirmChangelog` | `true` | See [Approval policy](#approval-policy) |

## Upgrading from 0.x

- Existing `changelog.json` files work unchanged; `config` is optional.
- The old `--action=stash|newFeature|closeFeature|newRelease|closeRelease|md`, `--p`/`--f`/`--m`, `--noTag`, `--sg` and `--sf` options still work.
- `feature start` no longer pushes the new branch (use `--push`); it is pushed when the feature is merged.
- The version is bumped by editing `package.json` directly instead of running `npm version`, so npm's `preversion`/`version`/`postversion` scripts are not run.
- Sections in `CHANGELOG.md` follow the Keep a Changelog order (Added, Changed, Deprecated, Removed, Fixed, Security).
- Tags are now annotated (`git tag -a`), and merges never open an editor.

## Development

Bun is used for everything except running the published file:

    bun test             # unit + end-to-end tests (real git repos in a temp dir)
    bun run build        # bundles src/ into out/bin.js for Node
    bun run test:node    # end-to-end tests against the Node bundle
    bun src/cli.ts …     # run from source

## License

MIT.
