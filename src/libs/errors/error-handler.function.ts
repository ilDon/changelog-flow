import { InfoErrors } from 'changelog-flow/libs/errors//errors.enum';

export function errorHandler(message: string): void {
  if (Object.values(InfoErrors).includes(message as InfoErrors))
    return info(message);

  fatal(message);
  throw new Error();
}

function fatal(message: string): void {
  console.error('FATAL ERROR:', message);
}

function info(message: string): void {
  console.log('INFO:', message);
}
