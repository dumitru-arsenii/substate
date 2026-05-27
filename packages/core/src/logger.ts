import type { CascadeLogger, CascadeLogLevel } from "./types";

const logConfig: Record<`can${Capitalize<CascadeLogLevel>}`, boolean> = {
  canInfo: true,
  canWarn: true,
  canError: true,
  canDebug: true,
} as const;

const colors = {
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
};
const formatDateNow = () => {
  const pad = (num: number) => num.toString().padStart(2, "0");
  const date = new Date();
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

export function createCascadeLogger(key: string): CascadeLogger {
  return {
    info: (message, ctx) => {
      if (logConfig.canInfo) {
        console.log(
          colors.gray(`[${formatDateNow()}]`),
          colors.cyan(`${key}:`),
          message,
          ctx,
        );
      }
    },
    error: (message, ctx) => {
      if (logConfig.canError) {
        console.error(
          colors.gray(`[${formatDateNow()}]`),
          colors.red(`${key}:`),
          message,
          ctx,
        );
      }
    },
    warn: (message, ctx) => {
      if (logConfig.canWarn) {
        console.warn(
          colors.gray(`[${formatDateNow()}]`),
          colors.yellow(`${key}:`),
          message,
          ctx,
        );
      }
    },
    debug: (message, ctx) => {
      if (logConfig.canDebug) {
        console.log(
          colors.gray(`[${formatDateNow()}]`),
          colors.green(`${key}:`),
          message,
          ctx,
        );
      }
    },
  };
}

export function setCascadeLogLevel(level: CascadeLogLevel) {
  switch (level) {
    case "debug":
      logConfig.canDebug =
        logConfig.canInfo =
        logConfig.canWarn =
        logConfig.canError =
          true;
      break;
    case "info":
      logConfig.canDebug = false;
      logConfig.canInfo = logConfig.canWarn = logConfig.canError = true;
      break;
    case "warn":
      logConfig.canDebug = logConfig.canInfo = false;
      logConfig.canWarn = logConfig.canError = true;
      break;
    case "error":
      logConfig.canDebug = logConfig.canInfo = logConfig.canWarn = false;
      logConfig.canError = true;
      break;
  }
}
