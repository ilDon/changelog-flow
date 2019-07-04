import { Question } from 'inquirer';

export const LOG_TYPES: Question = {
  type: 'list',
  name: 'type',
  message: 'What type of change do you want to add?',
  choices: [
    { name: 'added: for new features', value: 'added' },
    { name: 'changed: for changes in existing functionality', value: 'changed' },
    { name: 'deprecated: for soon-to-be removed features', value: 'deprecated' },
    { name: 'removed: for now removed features', value: 'removed' },
    { name: 'fixed: for any bug fixes', value: 'fixed' },
    { name: 'security: in case of vulnerabilities', value: 'security' }
  ]
};
