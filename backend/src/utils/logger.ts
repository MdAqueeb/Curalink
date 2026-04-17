import { env } from "../config/env.js";

type LogArg = unknown;

const isProd = env.NODE_ENV === "production";

function fmt(level: string, msg: string, meta?: LogArg) {
  const ts = new Date().toISOString();
  if (meta !== undefined) return `[${ts}] ${level} ${msg} ${JSON.stringify(meta)}`;
  return `[${ts}] ${level} ${msg}`;
}

export const logger = {
  info(msg: string, meta?: LogArg) {
    console.log(fmt("INFO", msg, meta));
  },
  warn(msg: string, meta?: LogArg) {
    console.warn(fmt("WARN", msg, meta));
  },
  error(msg: string, meta?: LogArg) {
    console.error(fmt("ERROR", msg, meta));
  },
  debug(msg: string, meta?: LogArg) {
    if (!isProd) console.log(fmt("DEBUG", msg, meta));
  },
  async timeit<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      logger.debug(`${label} completed`, { ms: Date.now() - start });
      return result;
    } catch (err) {
      logger.error(`${label} failed`, { ms: Date.now() - start, err: (err as Error).message });
      throw err;
    }
  },
};
