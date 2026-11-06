/*
 * Harness stub: @utils/types
 * Mirrors the runtime values the plugin actually uses.
 */

export enum OptionType {
    STRING,
    NUMBER,
    BIGINT,
    BOOLEAN,
    SELECT,
    SLIDER,
    COMPONENT,
    CUSTOM
}

export enum StartAt {
    Init = "Init",
    DOMContentLoaded = "DOMContentLoaded",
    WebpackReady = "WebpackReady"
}

export default function definePlugin<P extends Record<string, any>>(plugin: P) {
    return plugin as P & { started: boolean; };
}
