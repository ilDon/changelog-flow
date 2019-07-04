import { Question } from 'inquirer';

export const COMMIT_CHANGED_SEPARATELY: Question = {
  type: 'confirm',
  name: 'choice',
  message: 'Do you want to commit changed files now?'
};
