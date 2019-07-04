export enum infoErrors {
  cleanedEmpty = 'Log entries without a meaningful update message have been removed.'
}

export enum fatalErrors {
  notARepository = 'The current working folder is not a valid GIT repository',
  noPackageJson = 'No package.json file found in the current working directory',
  noLogsProvided = 'You must provide at least one update with a meaningful update message'
}
