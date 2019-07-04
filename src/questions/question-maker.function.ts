import * as inquirer from 'inquirer';

export function questionMaker(questions: inquirer.Questions): Promise<inquirer.Answers> {
  return inquirer.prompt(questions);
}
