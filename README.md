#  @BOHR/changelogger

CLI tool for creating, updating and maintaining CHANGELOG files. _Because everyone needs to changelog once in a while_.

`@BOHR/changelogger` makes it easy to keep your `version` of `package.json` up-to-date, generate CHANGELOG data, store it in a reusable `json` file, and finally automatically generate a CHANGELOG file (in `markdown`).

The structure of the log data generated with `@BOHR/changelogger` adheres to the [Semantic Versioning](https://semver.org/spec/v2.0.0.html) specifications and the resulting CHANGELOG file is based on the guidelines by [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Updated files are also automatically committed (you can opt-out) to `git`, following the [GitFlow](https://datasift.github.io/gitflow/IntroducingGitFlow.html) branching model (you can opt-out).

This tool is under development, `PR`s are welcome!

## Installation

The easiest way to use `@BOHR/changelogger` is to intall it globally:

    npm i -g @BOHR/changelogger

or

    yarn global add @BOHR/changelogger

`@BOHR/changelogger` handles some `git` operations via the command line. To perform such `git` operations, you also need to have installed the `git` CLI. To install it, please refer to [Getting Started - Installing Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git). Alternatively, you may skip all git-related operations with `--sg`.

## Git and GitFlow support

`@BOHR/changelogger` makes it easy to commit all newly created or modified files, and follow the GitFlow branching model in the process.

Before running nearly any action, `@BOHR/changelogger` checks if there are files to commit in the current `branch`. If so, it asks you for a commit message, and then it `commit`s and `push`es them to the remote repository.

Additionally, `@BOHR/changelogger` provides few quick commands to easily create and close feature branches, and stash changelog entries in a temp store to easily add them in future releases.

## Usage

Open a terminal window where the `package.json` file of your project is located.

Run: `bohr-cglg`, the CLI will then ask you whether you want to:

- `stash`: stashes new log entries for a future update
- `newFeature`: starts a new feature
- `closeFeature`: closes current feature
- `newRelease`: creates a new release
- `closeRelease`: close current release
- `md`: build the CHANGELOG.md file

You can skip this step by passing the argument `--action` in terminal (e.g. `--action=stash`, see #Options).

### Stashing new log entries for a future update

Allows you to add changes to a temporary property in `changelog.json`.

You will be asked what kind of change you want to add:

- _added_: for new features;
- _changed_: for changes in existing functionality;
- _deprecated_: for soon-to-be removed features;
- _removed_: for now removed features;
- _fixed_: for any bug fixes;
- _security_: in case of vulnerabilities.

You will then be asked to enter the description of the new log item. Be sure to [write good git commit messages](https://juffalow.com/other/write-good-git-commit-message)!

`@BOHR/changelogger` will then ask you if you want to

- `Add another change`: takes you back to the change type selection to repeat the process for a new log entry;
- `Save changes and update the CHANGELOG`: saves the changes in the `temp` property in `changelog.json`.

### Starting a new feature

Useful to follow the GitFlow branching model. 

Selecting this option will help you to create a new feature branch that follows the naming structure `feature/[name-of-the-feature]`.

### Closing the current feature

Useful to follow the GitFlow branching model. 

Selecting this option will:

- merge on `develop` the current `feature` branch (if compliant with the structure `feature/[name-of-the-feature]`);
- delete the local and the remote `feature` branch.

You will then be asked if you want to `Stash new log entries for a future update`.

### Creating a new release

You will be guided through the process of creating a new release of your project.

#### Versioning

`@BOHR/changelogger` will ask you what kind of update you are making, based on the [Semantic Versioning](https://semver.org/spec/v2.0.0.html) specifications:

- _patch_: for making backwards-compatible bug fixes;
- _minor_: for adding one or more functionalities in a backwards-compatible manner;
- _major_: for making incompatible API changes.

You can also skip this step by setting the `updateType` variable when running the command `bohr-cglg` (see #Options).

You will then be guided through the process described for `Stashing new log entries for a future update`. In this case, once done, selecting `Save changes and update the CHANGELOG` will:

- update the `version` in `package.json`;
- save all new changes in `changelog.json` under the new version number with the current date (YYYY-MM-DD);
- generate the CHANGELOG file in `markdown`.

#### Git and GitFlow support

Unless you opt-out of GitFlow (see #Options), `@BOHR/changelogger` will also:

- close the current feature branch (see `Closing the current feature`);
- create a new release branch (`release/[version-number]`);
- `commit` and `push` all changes.

#### Options

| Arg | Type | Description | Default |
|--------|------|-------------|---------|
| `p` | `[string]` | sets `updateType` to `patch` | `undefined` |
| `f` | `[string]` | sets `updateType` to `minor` | `undefined` |
| `m` | `[string]` | sets `updateType` to `major` | `undefined` |
| `sg` | `[boolean]` | skips all git operations | `false` |
| `sf` | `[boolean]` | skips all GitFlow operations | `false` |
| `action` | `[string]` | sets the action to be performed | `undefined` |

Usage esample:

    bohr-cglg --p --sf --action=newRelease

*If the `updateType` argument is omitted, the CLI will ask to pick it.*

### Closing the current release

Useful to follow the GitFlow branching model. 

Selecting this option will:

- merge on `develop` the current `release` branch (if compliant with the structure `release/[name-of-the-feature]`);
- merge on `master` the current `release` branch (if compliant with the structure `release/[name-of-the-feature]`);
- delete the local and the remote `release` branch;
- ask if a new `tag` should be created. If so, a new tag `vX.X.X` will be created and pushed to `origin`.

### Building the CHANGELOG.md file

You can manually rebuild the CHANGELOG file by selecting the second option after running `bohr-cglg`. 

`@BOHR/changelogger` will generate the `markdown` file right away in the current working project based on the contents of `changelog.json`.

## License

MIT.