import { Question } from 'inquirer';

export const ADD_TEMP_TO_RELEASE: Question = {
  type: 'confirm',
  name: 'choice',
  message: 'Temp logs found in changelog.json, add them to this release?'
};
