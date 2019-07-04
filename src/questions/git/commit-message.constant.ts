import { Question } from 'inquirer';

export const COMMITT_MESSAGE: Question = {
  type: 'input',
  name: 'message',
  message: 'Committ message:'
};
