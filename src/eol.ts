export type Eol = '\n' | '\r\n';

/** The line ending a text mostly uses, or null when it has no line breaks. */
export function detectEol(text: string): Eol | null {
  const crlf = text.match(/\r\n/g)?.length ?? 0;
  const lf = (text.match(/\n/g)?.length ?? 0) - crlf;
  if (!crlf && !lf) return null;
  return crlf > lf ? '\r\n' : '\n';
}

/** Rewrites every line break in `text` (LF, CRLF or a mix) as `eol`. */
export function applyEol(text: string, eol: Eol): string {
  const normalized = text.replace(/\r\n/g, '\n');
  return eol === '\n' ? normalized : normalized.replace(/\n/g, '\r\n');
}
