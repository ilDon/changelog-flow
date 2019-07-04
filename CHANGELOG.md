# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file has been automatially generated with [@bohr/changelogger](https://github.com/bohr-app/changelogger)

---

## [0.7.5] - 2019-02-22
### Fixed
- Added timout after version bump to ensure data is updated on disk.

## [0.7.4] - 2019-02-22
### Fixed
- Awaiting command to update package.json version.

## [0.7.3] - 2019-01-23
### Fixed
- committing files before closing a release.

## [0.7.2] - 2019-01-23
### Changed
- checking if changelog.json exists before starting any process.

## [0.7.1] - 2019-01-11
### Changed
- using --action to set the action being performed in package.json script publishToNpm.

## [0.7.0] - 2019-01-11
### Added
- added ability to set the action to be performed in terminal.

### Changed
- removed unnecessary console.log.

## [0.6.1] - 2018-12-23
### Added
- Added ability to postpone commiting added/changed files.

### Changed
- Improved console logs when closing a release.
- Improved feature name cleaning.
- improved commit message when stashing logs for future updates.

## [0.6.0] - 2018-12-23
### Added
- Added ability to close releases and add version tag.

## [0.5.1] - 2018-12-22
### Changed
- added description of new features to README.

## [0.5.0] - 2018-12-22
### Added
- Added ability to stash log entries to be added in future releases.
- Added ability to retrieve logs from the temp stash and add them to the current release.
- Added ability to open and close features (GitFlow) and add temp logs after.

### Changed
- Renamed the initial menu item to create a new release.
- Improved the method to set the project folders.

## [0.4.3] - 2018-12-17
### Fixed
- commit message after changelog.json editing shows right version number.
- fixed spelling in readme and changelog files.

## [0.4.2] - 2018-12-17
### Added
- Using @bohr/changelogger on itself when publishing to npm.

### Changed
- Release branch is now created before updating the version in package.json.

### Fixed
- removed unnecessary console.log outputs.

## [0.4.1] - 2018-12-13
### Fixed
- fixed publish script to prevent double submission.
- fixed build script by also including the tspath command.

## [0.4.0] - 2018-12-13
### Added
- Added ability to skip all git-related operations.
- Added ability to automatically apply the git-flow logic by mergin on develop and closing the feature branch and then creating the release branch.

## [0.3.1] - 2018-12-12
### Fixed
- Fixed misspell in README.

## [0.3.0] - 2018-12-12
### Added
- added ability to set `updateType` via the CLI.

### Changed
- improved the error handling logic. Now throwing an uncaught exception on fatal errors.

## [0.2.0] - 2018-12-11
### Added
- Added `installation` and `usage` sections in README.

## [0.1.3] - 2018-12-11
### Fixed
- Removed unnecessary call to start in bin.js.

## [0.1.2] - 2018-12-11
### Added
- added bin.js for global support.

### Fixed
- fixed path to bin.js in package.json.

## [0.1.1] - 2018-12-11
### Fixed
- Added peer dependencies to --dev.

## [0.1.0] - 2018-12-11
### Added
- changes can be set via CLI .
- changes are stored in a json file.
- CHANGELOG file automatically generated based on the contents of the json file.

