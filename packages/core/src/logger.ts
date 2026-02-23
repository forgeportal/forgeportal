import pino from 'pino';
import type { DestinationStream } from 'pino';
import { redactSecrets } from './redact.js';

export type Logger = pino.Logger;

export function createLogger(opts?: {
  level?: string;
  name?: string;
  destination?: DestinationStream;
}): Logger {
  return pino(
    {
      level: opts?.level ?? 'info',
      name: opts?.name,
      hooks: {
        logMethod(inputArgs, method) {
          const redactedArgs = inputArgs.map((arg) =>
            typeof arg === 'string' ? redactSecrets(arg) : arg,
          );
          return method.apply(this, redactedArgs as Parameters<typeof method>);
        },
      },
    },
    opts?.destination as DestinationStream,
  );
}
