import { existsSync, readFileSync } from 'node:fs';
import { flagList, type Flags } from './args';
import type { FileConfig } from './config';
import { CliError } from './ui';

export const CHANGELOG_JSON = 'changelog.json';

export const ENTRY_TYPES = ['added', 'changed', 'deprecated', 'removed', 'fixed', 'security'] as const;

export type EntryType = typeof ENTRY_TYPES[number];

export const TYPE_HELP: Record<EntryType, string> = {
  added: 'new features',
  changed: 'changes in existing functionality',
  deprecated: 'soon-to-be removed features',
  removed: 'now removed features',
  fixed: 'bug fixes',
  security: 'vulnerabilities'
};

const TYPE_ALIASES: Record<string, EntryType> = {
  add: 'added',
  feat: 'added',
  feature: 'added',
  new: 'added',
  change: 'changed',
  changes: 'changed',
  deprecate: 'deprecated',
  remove: 'removed',
  fix: 'fixed',
  bugfix: 'fixed',
  sec: 'security'
};

export interface Entry {
  type: EntryType;
  value: string;
}

export interface Release {
  version: string;
  date: string;
  items: Entry[];
}

export interface ChangelogData {
  title: string;
  description: string;
  config?: FileConfig;
  temp?: Entry[];
  changes: Release[];
  [key: string]: unknown;
}

export const ENTRY_FORMAT_HINT =
  `Format: --entry "<type>: <text>", where type is one of: ${ENTRY_TYPES.map(t => `${t} (${TYPE_HELP[t]})`).join(', ')}.`;

export function normalizeType(type: string): EntryType | null {
  const key = type.trim().toLowerCase();
  if ((ENTRY_TYPES as readonly string[]).includes(key)) return key as EntryType;
  return TYPE_ALIASES[key] ?? null;
}

function cleanValue(value: string): string {
  return value.trim().replace(/^[-*]\s+/, '');
}

export function parseEntry(raw: string): Entry {
  const match = /^\s*([a-z]+)\s*:\s*([\s\S]*)$/i.exec(raw);
  const type = match ? normalizeType(match[1]) : null;
  if (!match || !type)
    throw new CliError(`Invalid changelog entry: "${raw}"`, [ENTRY_FORMAT_HINT]);
  const value = cleanValue(match[2]);
  if (!value) throw new CliError(`Changelog entry "${raw}" has no text.`, [ENTRY_FORMAT_HINT]);
  return { type, value };
}

/** Collects entries from `--entry "type: text"` and the `--added "text"` style shorthands. */
export function entriesFromFlags(flags: Flags, extra: string[] = []): Entry[] {
  const entries = [...flagList(flags, 'entry'), ...extra].map(parseEntry);
  for (const type of ENTRY_TYPES) {
    for (const value of flagList(flags, type)) {
      const cleaned = cleanValue(value);
      if (!cleaned) throw new CliError(`--${type} needs some text.`);
      entries.push({ type, value: cleaned });
    }
  }
  return entries;
}

export function defaultData(): ChangelogData {
  return {
    title: 'Changelog',
    description: 'All notable changes to this project will be documented in this file.\n\n' +
      'The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n\n' +
      'This file has been automatically generated with [changelog-flow](https://github.com/ilDon/changelog-flow)',
    temp: [],
    changes: []
  };
}

export function loadChangelog(path: string): ChangelogData | null {
  if (!existsSync(path)) return null;
  let data: ChangelogData;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new CliError(`${path} is not valid JSON: ${(error as Error).message}`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new CliError(`${path} must contain a JSON object.`);
  if (!Array.isArray(data.changes)) data.changes = [];
  if (data.temp !== undefined && !Array.isArray(data.temp)) data.temp = [];
  return data;
}

export function serialize(data: ChangelogData): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatItem(value: string): string {
  let text = value.trim().replace(/[;,]+$/, '');
  if (!/[.!?]$/.test(text)) text += '.';
  return text.replace(/\n/g, '\n  ');
}

/** Renders CHANGELOG.md following https://keepachangelog.com. */
export function renderMarkdown(data: ChangelogData): string {
  let out = `# ${data.title}\n${data.description}\n\n---\n\n`;
  for (const release of data.changes) {
    out += `## [${release.version}] - ${release.date}\n`;
    for (const type of ENTRY_TYPES) {
      const items = release.items.filter(item => item.type === type);
      if (!items.length) continue;
      out += `### ${capitalize(type)}\n`;
      for (const item of items) out += `- ${formatItem(item.value)}\n`;
      out += '\n';
    }
  }
  return out;
}

export function formatEntry(entry: Entry): string {
  return `${entry.type}: ${entry.value}`;
}

export function todayISO(date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
