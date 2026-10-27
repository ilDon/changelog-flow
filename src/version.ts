import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ChangelogData } from './changelog';
import { CliError } from './ui';

interface Span {
  start: number;
  end: number;
  value: string;
}

/**
 * Finds the top-level `"version": "..."` string of a JSON document without
 * re-serialising it, so the file keeps its exact formatting.
 */
export function findTopLevelVersion(text: string): Span | null {
  let depth = 0;
  let lastString: string | null = null;
  let awaitingVersion = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      const start = i;
      i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\') i++;
        i++;
      }
      if (depth !== 1) continue;
      const value = JSON.parse(text.slice(start, i + 1)) as string;
      if (awaitingVersion) return { start: start + 1, end: i, value };
      lastString = value;
    } else if (ch === '{' || ch === '[') {
      if (awaitingVersion) return null;
      depth++;
    } else if (ch === '}' || ch === ']') {
      depth--;
    } else if (ch === ':' && depth === 1) {
      awaitingVersion = lastString === 'version';
    } else if (ch === ',') {
      lastString = null;
      awaitingVersion = false;
    } else if (awaitingVersion && !/\s/.test(ch)) {
      return null; // "version" is not a string
    }
  }
  return null;
}

export function setTopLevelVersion(text: string, version: string, file: string): string {
  const span = findTopLevelVersion(text);
  if (!span) throw new CliError(`${file} has no top-level "version" string.`, [`Add "version": "0.0.0" to ${file}, or change config.versionFiles.`]);
  return text.slice(0, span.start) + version + text.slice(span.end);
}

export function readVersionFile(path: string): string | null {
  if (!existsSync(path)) return null;
  return findTopLevelVersion(readFileSync(path, 'utf8'))?.value ?? null;
}

export interface CurrentVersion {
  version: string;
  source: string;
}

export function currentVersion(cwd: string, versionFiles: string[], data: ChangelogData | null): CurrentVersion {
  for (const file of versionFiles) {
    const version = readVersionFile(join(cwd, file));
    if (version) return { version, source: file };
  }
  const latest = data?.changes[0]?.version;
  if (latest) return { version: latest, source: 'changelog.json' };
  return { version: '0.0.0', source: 'default' };
}

const LOCKFILES = ['package-lock.json', 'npm-shrinkwrap.json'];

/** Computes the new contents of every version file. Returns [relativePath, contents] pairs. */
export function versionFileUpdates(cwd: string, versionFiles: string[], version: string): Array<[string, string]> {
  const updates: Array<[string, string]> = [];
  for (const file of versionFiles) {
    const path = join(cwd, file);
    if (!existsSync(path)) continue;
    updates.push([file, setTopLevelVersion(readFileSync(path, 'utf8'), version, file)]);
    if (file !== 'package.json' && !file.endsWith('/package.json')) continue;
    const dir = file.slice(0, -'package.json'.length);
    for (const lock of LOCKFILES) {
      const lockPath = join(cwd, dir, lock);
      if (!existsSync(lockPath)) continue;
      const text = readFileSync(lockPath, 'utf8');
      const json = JSON.parse(text);
      json.version = version;
      if (json.packages?.['']) json.packages[''].version = version;
      const indent = /^[ \t]+(?=")/m.exec(text)?.[0] ?? '  ';
      updates.push([`${dir}${lock}`, `${JSON.stringify(json, null, indent)}\n`]);
    }
  }
  return updates;
}
