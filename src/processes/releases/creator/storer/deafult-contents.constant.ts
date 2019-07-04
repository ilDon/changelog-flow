// tslint:disable:max-line-length

export interface ChangeLogger {
  title: string;
  description: string;
  temp: Array<ChangeItems>;
  changes: Array<ChangeDetails>;
}

export interface ChangeDetails {
  version: string;
  date: string;
  items: Array<ChangeItems>;
}

export interface ChangeItems {
  type: 'added' | 'changed' | 'deprecated' | 'removed' | 'fixed' | 'security';
  value: string;
}

export const DEFAULT_CONTENTS: ChangeLogger = {
  title: 'Changelog',
  description: 'All notable changes to this project will be documented in this file.\n\nThe format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n\nThis file has been automatially generated with [@bohr/changelogger](https://github.com/bohr-app/changelogger)',
  temp: [],
  changes: []
};
