import { UpdateTypes } from '@bohr/changelogger/processes/releases/creator/versioning/update-types.enum';
import { Question } from 'inquirer';

export const UPDATE_TYPES: Question = {
  type: 'list',
  name: 'type',
  message: 'What type of update are you making?',
  choices: [
    { name: 'patch: for making backwards-compatible bug fixes', value: UpdateTypes.p },
    { name: 'minor: for adding one or more functionalities in a backwards-compatible manner', value: UpdateTypes.f },
    { name: 'major: for making incompatible API changes', value: UpdateTypes.m }
  ]
};
