import { CliError } from './ui';

export type FlagValue = string | boolean | string[];
export type Flags = Record<string, FlagValue | undefined>;

export interface ParsedArgs {
  positionals: string[];
  flags: Flags;
}

/** Options that take a value (`--name value` or `--name=value`). */
const VALUE_OPTIONS = new Set([
  'entry', 'added', 'changed', 'deprecated', 'removed', 'fixed', 'security',
  'message', 'action', 'cwd', 'main', 'develop', 'remote', 'since', 'agents-file'
]);

/** Value options that can be passed more than once. */
const REPEATABLE = new Set(['entry', 'added', 'changed', 'deprecated', 'removed', 'fixed', 'security', 'agents-file']);

const SHORT: Record<string, string> = { h: 'help', v: 'version', e: 'entry', n: 'dry-run' };

function kebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function coerce(value: string): string | boolean {
  if (/^(true|yes|1)$/i.test(value)) return true;
  if (/^(false|no|0)$/i.test(value)) return false;
  return value;
}

/**
 * Small, dependency-free argv parser. Supports `--flag`, `--no-flag`, `--key=value`,
 * `--key value` (for known value options), repeatable options, short aliases and
 * camelCase legacy flags such as `--noTag`.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Flags = {};

  const set = (key: string, value: string): void => {
    if (REPEATABLE.has(key)) {
      const list = (flags[key] as string[] | undefined) ?? [];
      list.push(value);
      flags[key] = list;
    } else {
      flags[key] = value;
    }
  };

  const takeValue = (key: string, inline: string | undefined, index: number): [string, number] => {
    if (inline !== undefined) return [inline, index];
    const next = argv[index + 1];
    if (next === undefined || (next.startsWith('--') && next.length > 2))
      throw new CliError(`Option --${key} needs a value.`);
    return [next, index + 1];
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }

    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      const rawKey = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
      const inline = eq === -1 ? undefined : arg.slice(eq + 1);
      const key = kebab(rawKey);

      if (VALUE_OPTIONS.has(key)) {
        const [value, nextIndex] = takeValue(key, inline, i);
        i = nextIndex;
        set(key, value);
      } else if (key.startsWith('no-') && inline === undefined) {
        flags[key.slice(3)] = false;
      } else {
        flags[key] = inline === undefined ? true : coerce(inline);
      }
      continue;
    }

    if (arg.startsWith('-') && arg.length > 1 && !/^-\d/.test(arg)) {
      const letters = arg.slice(1);
      for (let j = 0; j < letters.length; j++) {
        const key = SHORT[letters[j]];
        if (!key) throw new CliError(`Unknown option -${letters[j]}.`);
        if (VALUE_OPTIONS.has(key)) {
          const rest = letters.slice(j + 1);
          const [value, nextIndex] = takeValue(key, rest || undefined, i);
          i = nextIndex;
          set(key, value);
          break;
        }
        flags[key] = true;
      }
      continue;
    }

    positionals.push(arg);
  }

  return { positionals, flags };
}

export function flagList(flags: Flags, key: string): string[] {
  const value = flags[key];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return [value];
  return [];
}

export function flagString(flags: Flags, key: string): string | undefined {
  const value = flags[key];
  return typeof value === 'string' ? value : undefined;
}
