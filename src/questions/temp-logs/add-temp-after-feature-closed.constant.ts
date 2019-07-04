import { Question } from 'inquirer';

export const ADD_TEMP_AFTER_FEATURE_CLOSED: Question = {
  type: 'confirm',
  name: 'choice',
  message: 'Do you want to add any temp log?'
};
