import { Question } from 'inquirer';

export const NEXT_STEP: Question = {
  type: 'list',
  name: 'next',
  message: 'What do you want to do next?',
  choices: [
    { name: 'Add another change', value: 'add' },
    { name: 'Save changes and update the CHANGELOG', value: 'finish' }
  ]
};
