import { Question } from 'inquirer';

export const SHOULD_ADD_TAG: Question = {
  type: 'confirm',
  name: 'choice',
  message: 'Do you want to add a tag for this release?'
};
