import { Question } from 'inquirer';
/* eslint-disable no-shadow */

export enum SupportedActions {
  stash = 'stash',
  newFeature = 'newfeature',
  closeFeature = 'closefeature',
  newRelease = 'newRelease',
  closeRelease = 'closeRelease',
  md = 'md'
}

export const START_ACTION_PICKER: Question = {
  type: 'list',
  name: 'action',
  message: 'What do you want to do?',
  choices: [
    { name: 'Stash new log entries for a future update', value: SupportedActions.stash },
    { name: 'Start a new feature', value: SupportedActions.newFeature },
    { name: 'Close current feature', value: SupportedActions.closeFeature },
    { name: 'Create a new release', value: SupportedActions.newRelease },
    { name: 'Close current release', value: SupportedActions.closeRelease },
    { name: 'Build the CHANGELOG.md file', value: SupportedActions.md }
  ]
};
