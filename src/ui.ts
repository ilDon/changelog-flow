const env = process.env;

let colorOn = !!process.stdout.isTTY && !env.NO_COLOR && env.TERM !== 'dumb';
if (env.FORCE_COLOR !== undefined) colorOn = env.FORCE_COLOR !== '0';

export function setColor(on: boolean): void {
  colorOn = on;
}

const paint = (open: number, close: number) => (text: string): string =>
  colorOn ? `\x1b[${open}m${text}\x1b[${close}m` : text;

export const bold = paint(1, 22);
export const dim = paint(2, 22);
export const red = paint(31, 39);
export const green = paint(32, 39);
export const yellow = paint(33, 39);
export const cyan = paint(36, 39);

/** A failure the user (or agent) has to fix. Exit code 1. */
export class CliError extends Error {
  constructor(message: string, public hints: string[] = []) {
    super(message);
  }
}

export interface Section {
  title: string;
  lines: string[];
}

/**
 * The command cannot continue without more input. Carries step-by-step
 * instructions and the command to re-run. Exit code 2.
 */
export class ActionRequired extends Error {
  constructor(
    public reason: string,
    public steps: string[],
    public sections: Section[] = [],
    public rerun?: string,
    public data?: unknown
  ) {
    super(reason);
  }
}

export interface Outcome {
  summary: string;
  details?: string[];
  next?: string[];
  data?: unknown;
  /** Already printed by the command (e.g. status): skip the summary line in text mode. */
  printed?: boolean;
}

export class Reporter {
  constructor(private json: boolean) {}

  private write(line: string): void {
    (this.json ? process.stderr : process.stdout).write(`${line}\n`);
  }

  step(message: string): void {
    this.write(`${cyan('›')} ${message}`);
  }

  command(command: string, dryRun: boolean): void {
    this.write(dim(`  ${dryRun ? '[dry-run] ' : ''}$ ${command}`));
  }

  warn(message: string): void {
    this.write(`${yellow('!')} ${message}`);
  }

  plain(message = ''): void {
    this.write(message);
  }
}

export function shellQuote(arg: string): string {
  if (arg !== '' && /^[\w@%+=:,./-]+$/.test(arg)) return arg;
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

function indent(lines: string[], prefix = '  '): string {
  return lines.map(line => `${prefix}${line}`).join('\n');
}

export function printOutcome(outcome: Outcome, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify({ status: 'ok', ...outcome, printed: undefined }, null, 2)}\n`);
    return;
  }
  if (outcome.printed) return;
  const out: string[] = [`${green('✔')} ${bold(outcome.summary)}`];
  if (outcome.details?.length) out.push(indent(outcome.details));
  if (outcome.next?.length) out.push('', bold('Next:'), indent(outcome.next, '  → '));
  process.stdout.write(`${out.join('\n')}\n`);
}

export function printActionRequired(error: ActionRequired, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify({
      status: 'action_required',
      reason: error.reason,
      steps: error.steps,
      sections: error.sections,
      rerun: error.rerun,
      data: error.data
    }, null, 2)}\n`);
    return;
  }
  const out: string[] = [`${yellow('⚠ ACTION REQUIRED:')} ${bold(error.reason)}`, '', bold('What to do:')];
  error.steps.forEach((step, i) => out.push(`  ${i + 1}. ${step}`));
  for (const section of error.sections) {
    out.push('', bold(`${section.title}:`));
    out.push(section.lines.length ? indent(section.lines) : dim('  (none)'));
  }
  if (error.rerun) out.push('', bold('Then run:'), `  ${error.rerun}`);
  process.stdout.write(`${out.join('\n')}\n`);
}

export function printError(error: CliError, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify({ status: 'error', message: error.message, hints: error.hints }, null, 2)}\n`);
    return;
  }
  const out = [`${red('✖')} ${bold(error.message)}`];
  if (error.hints.length) out.push(indent(error.hints, '  → '));
  process.stderr.write(`${out.join('\n')}\n`);
}
