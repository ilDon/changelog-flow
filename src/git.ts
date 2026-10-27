import { execFile } from 'node:child_process';
import { CliError, type Reporter, shellQuote } from './ui';

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export class GitError extends CliError {
  constructor(args: string[], result: RunResult, hints: string[] = []) {
    const output = (result.stderr || result.stdout).trim();
    super(`git ${args.join(' ')} failed${output ? `:\n${output}` : ''}`, hints);
  }
}

export class Git {
  private env: NodeJS.ProcessEnv;

  constructor(
    readonly cwd: string,
    private reporter: Reporter,
    readonly dryRun = false,
    interactive = true
  ) {
    // English, stable output so it can be parsed; never block on a credential prompt when an agent drives us.
    this.env = { ...process.env, LC_ALL: 'C', LANGUAGE: 'C', ...(interactive ? {} : { GIT_TERMINAL_PROMPT: '0' }) };
  }

  /** Runs a read-only git command. Never throws. */
  run(args: string[]): Promise<RunResult> {
    return new Promise(resolve => {
      execFile('git', args, { cwd: this.cwd, env: this.env, maxBuffer: 256 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
        const raw = error as (NodeJS.ErrnoException & { code?: number | string }) | null;
        if (raw?.code === 'ENOENT')
          return resolve({ code: 127, stdout: '', stderr: 'git executable not found. Install git or use --sg to skip git operations.' });
        const code = raw ? (typeof raw.code === 'number' ? raw.code : 1) : 0;
        resolve({ code, stdout: String(stdout), stderr: String(stderr) });
      });
    });
  }

  /** Runs a read-only git command and returns stdout. Throws on failure. */
  async read(args: string[]): Promise<string> {
    const result = await this.run(args);
    if (result.code !== 0) throw new GitError(args, result);
    return result.stdout;
  }

  /** Runs a command that changes the repository. Echoed, and skipped in dry-run mode. */
  async attempt(args: string[]): Promise<RunResult> {
    this.reporter.command(`git ${args.map(shellQuote).join(' ')}`, this.dryRun);
    if (this.dryRun) return { code: 0, stdout: '', stderr: '' };
    return this.run(args);
  }

  async exec(args: string[], hints: string[] = []): Promise<RunResult> {
    const result = await this.attempt(args);
    if (result.code !== 0) throw new GitError(args, result, hints);
    return result;
  }
}

export interface RepoState {
  branch: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  dirty: string[];
  localBranches: Set<string>;
  /** Remote-tracking branches as "<remote>/<branch>". */
  remoteBranches: Set<string>;
  /** Default branch of each remote (from refs/remotes/<remote>/HEAD), if known. */
  remoteHeads: Map<string, string>;
  tags: Set<string>;
  remotes: string[];
}

export function parseStatus(text: string): Pick<RepoState, 'branch' | 'upstream' | 'ahead' | 'behind' | 'dirty'> {
  const state = { branch: null as string | null, upstream: null as string | null, ahead: 0, behind: 0, dirty: [] as string[] };
  for (const line of text.split('\n')) {
    if (!line) continue;
    if (line.startsWith('# branch.head ')) {
      const head = line.slice(14);
      state.branch = head === '(detached)' ? null : head;
    } else if (line.startsWith('# branch.upstream ')) {
      state.upstream = line.slice(18);
    } else if (line.startsWith('# branch.ab ')) {
      const match = /\+(\d+) -(\d+)/.exec(line);
      if (match) {
        state.ahead = Number(match[1]);
        state.behind = Number(match[2]);
      }
    } else if (!line.startsWith('#')) {
      // 1 <XY> ... <path> | 2 <XY> ... <path>\t<orig> | u <XY> ... <path> | ? <path>
      const fields = line[0] === '1' ? 8 : line[0] === '2' ? 9 : line[0] === 'u' ? 10 : 1;
      const parts = line.split(' ');
      const path = parts.slice(fields).join(' ').split('\t')[0];
      if (line[0] !== '!') state.dirty.push(path);
    }
  }
  return state;
}

/** Reads everything we need about the repository with 3 parallel, local-only git calls. */
export async function readRepoState(git: Git): Promise<RepoState | null> {
  const [status, refs, remotes] = await Promise.all([
    git.run(['status', '--porcelain=v2', '--branch']),
    git.run(['for-each-ref', '--format=%(refname) %(symref)']),
    git.run(['remote'])
  ]);
  if (status.code !== 0) {
    if (/not a git repository/i.test(status.stderr)) return null;
    throw new GitError(['status'], status);
  }

  const localBranches = new Set<string>();
  const remoteBranches = new Set<string>();
  const remoteHeads = new Map<string, string>();
  const tags = new Set<string>();
  for (const line of refs.stdout.split('\n')) {
    if (!line) continue;
    const [ref, symref] = line.split(' ');
    if (ref.startsWith('refs/heads/')) {
      localBranches.add(ref.slice(11));
    } else if (ref.startsWith('refs/tags/')) {
      tags.add(ref.slice(10));
    } else if (ref.startsWith('refs/remotes/')) {
      const name = ref.slice(13);
      if (name.endsWith('/HEAD')) {
        const remote = name.slice(0, -5);
        if (symref?.startsWith(`refs/remotes/${remote}/`)) remoteHeads.set(remote, symref.slice(14 + remote.length));
      } else {
        remoteBranches.add(name);
      }
    }
  }

  return {
    ...parseStatus(status.stdout),
    localBranches,
    remoteBranches,
    remoteHeads,
    tags,
    remotes: remotes.stdout.split('\n').filter(Boolean)
  };
}
