import { createInterface } from 'node:readline';
import { bold, cyan, dim, green } from './ui';

export interface Choice<T> {
  label: string;
  value: T;
  hint?: string;
}

function abort(): never {
  process.stdout.write('\x1b[?25h\n');
  process.exit(130);
}

export function input(message: string, fallback?: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.on('SIGINT', () => {
    rl.close();
    abort();
  });
  const suffix = fallback ? dim(` (${fallback})`) : '';
  return new Promise(resolve => {
    rl.question(`${bold('?')} ${message}${suffix} `, answer => {
      rl.close();
      resolve(answer.trim() || fallback || '');
    });
  });
}

export async function confirm(message: string, fallback = true): Promise<boolean> {
  for (;;) {
    const answer = (await input(`${message} ${dim(fallback ? '[Y/n]' : '[y/N]')}`)).toLowerCase();
    if (!answer) return fallback;
    if (['y', 'yes', 's', 'si', 'sì'].includes(answer)) return true;
    if (['n', 'no'].includes(answer)) return false;
  }
}

async function selectByNumber<T>(message: string, choices: Choice<T>[]): Promise<T> {
  process.stdout.write(`${bold('?')} ${message}\n`);
  choices.forEach((choice, i) => process.stdout.write(`  ${i + 1}) ${choice.label}\n`));
  for (;;) {
    const answer = Number(await input('Choice:', '1'));
    if (answer >= 1 && answer <= choices.length) return choices[answer - 1].value;
  }
}

/** Arrow-key list selection (falls back to numbered input when raw mode is unavailable). */
export function select<T>(message: string, choices: Choice<T>[], initial = 0): Promise<T> {
  const stdin = process.stdin;
  const out = process.stdout;
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') return selectByNumber(message, choices);

  const width = Math.max(20, (out.columns || 80) - 4);
  const fit = (text: string): string => (text.length > width ? `${text.slice(0, width - 1)}…` : text);
  let index = Math.min(Math.max(initial, 0), choices.length - 1);

  const render = (first: boolean): void => {
    if (!first) out.write(`\x1b[${choices.length}A`);
    choices.forEach((choice, i) => {
      const text = fit(choice.label + (choice.hint ? `  ${choice.hint}` : ''));
      out.write(`\x1b[2K${i === index ? cyan(`❯ ${text}`) : `  ${text}`}\n`);
    });
  };

  out.write(`${bold('?')} ${message} ${dim('(↑/↓, enter)')}\n\x1b[?25l`);
  render(true);

  return new Promise(resolve => {
    const cleanup = (): void => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      out.write('\x1b[?25h');
    };
    const onData = (data: Buffer | string): void => {
      // One chunk can hold several keys (fast typing, paste): handle them one by one.
      for (const key of String(data).match(/\x1b\[[0-9;]*[A-Za-z]|\x1bO[A-Za-z]|[\s\S]/g) ?? []) {
        if (key === '\u0003') {
          cleanup();
          abort();
        }
        if (key === '\x1b[A' || key === '\x1bOA' || key === 'k') index = (index - 1 + choices.length) % choices.length;
        else if (key === '\x1b[B' || key === '\x1bOB' || key === 'j') index = (index + 1) % choices.length;
        else if (/^[1-9]$/.test(key) && Number(key) <= choices.length) index = Number(key) - 1;
        else if (key === '\r' || key === '\n') {
          cleanup();
          out.write(`\x1b[${choices.length + 1}A\x1b[0J${green('✔')} ${message} ${cyan(choices[index].label)}\n`);
          resolve(choices[index].value);
          return;
        }
      }
      render(false);
    };
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}
