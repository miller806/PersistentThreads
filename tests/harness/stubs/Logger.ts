/*
 * Harness stub: @utils/Logger
 * Collects log records so tests can assert on warnings/errors.
 */

export interface LogRecord {
    level: "info" | "warn" | "error" | "debug";
    name: string;
    args: any[];
}

export const logRecords: LogRecord[] = [];

function record(level: LogRecord["level"], name: string, args: any[]) {
    logRecords.push({ level, name, args });
}

export class Logger {
    constructor(public name: string, public color?: string) { }

    info(...args: any[]) { record("info", this.name, args); }
    warn(...args: any[]) { record("warn", this.name, args); }
    error(...args: any[]) { record("error", this.name, args); }
    debug(...args: any[]) { record("debug", this.name, args); }
}
