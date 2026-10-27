export type Bump = 'patch' | 'minor' | 'major';

export const BUMPS: Bump[] = ['patch', 'minor', 'major'];

interface SemVer {
  major: number;
  minor: number;
  patch: number;
  pre: string[];
}

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function parse(version: string): SemVer | null {
  const match = SEMVER.exec(version.trim().replace(/^v/, ''));
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    pre: match[4] ? match[4].split('.') : []
  };
}

export function isValid(version: string): boolean {
  return parse(version) !== null;
}

export function clean(version: string): string {
  return version.trim().replace(/^v/, '');
}

/** Same semantics as `npm version <bump>`. */
export function bump(version: string, type: Bump): string {
  const v = parse(version);
  if (!v) throw new Error(`Invalid version: ${version}`);
  const pre = v.pre.length > 0;
  switch (type) {
    case 'major':
      return pre && v.minor === 0 && v.patch === 0 ? `${v.major}.0.0` : `${v.major + 1}.0.0`;
    case 'minor':
      return pre && v.patch === 0 ? `${v.major}.${v.minor}.0` : `${v.major}.${v.minor + 1}.0`;
    case 'patch':
      return pre ? `${v.major}.${v.minor}.${v.patch}` : `${v.major}.${v.minor}.${v.patch + 1}`;
  }
}

function compareIdentifiers(a: string, b: string): number {
  const an = /^\d+$/.test(a);
  const bn = /^\d+$/.test(b);
  if (an && bn) return Number(a) - Number(b);
  if (an) return -1;
  if (bn) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function compare(a: string, b: string): number {
  const x = parse(a);
  const y = parse(b);
  if (!x || !y) throw new Error(`Cannot compare ${a} and ${b}`);
  for (const key of ['major', 'minor', 'patch'] as const)
    if (x[key] !== y[key]) return x[key] - y[key];
  if (!x.pre.length || !y.pre.length) return y.pre.length - x.pre.length;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    if (x.pre[i] === undefined) return -1;
    if (y.pre[i] === undefined) return 1;
    const diff = compareIdentifiers(x.pre[i], y.pre[i]);
    if (diff) return diff;
  }
  return 0;
}
