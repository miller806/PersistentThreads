/*
 * Harness stub: @api/Settings
 *
 * Behaves like Equicord's definePluginSettings:
 * - resolves defaults (including SELECT defaults)
 * - settings.store is writable and notifies listeners (auto-save equivalent)
 * - settings.use() re-renders the calling component on changes
 */

import * as React from "react";

import { OptionType } from "./types";

export interface SettingsChange {
    key: string;
    value: unknown;
}

const listeners = new Set<() => void>();
export const settingsChanges: SettingsChange[] = [];

function notify() {
    for (const listener of [...listeners]) listener();
}

function resolveDefault(definition: any): { hasDefault: boolean; value?: unknown; } {
    if (definition == null || typeof definition !== "object") return { hasDefault: false };

    if ("default" in definition) return { hasDefault: true, value: definition.default };

    if (definition.type === OptionType.SELECT && Array.isArray(definition.options)) {
        const option = definition.options.find((opt: any) => opt.default);
        if (option) return { hasDefault: true, value: option.value };
    }

    return { hasDefault: false };
}

export function definePluginSettings(definition: Record<string, any>, checks?: Record<string, any>) {
    if (checks) {
        for (const [key, check] of Object.entries(checks)) Object.assign(definition[key], check);
    }

    const plain: Record<string, any> = {};
    for (const [key, def] of Object.entries(definition)) {
        const { hasDefault, value } = resolveDefault(def);
        if (hasDefault) plain[key] = value;
    }

    const store = new Proxy(plain, {
        set(target, key, value) {
            target[key as string] = value;
            settingsChanges.push({ key: String(key), value });

            const onChange = definition[key as string]?.onChange;
            if (typeof onChange === "function") {
                try {
                    onChange(value);
                } catch (error) {
                    console.error("[harness] settings onChange threw", error);
                }
            }

            notify();
            return true;
        },
    });

    const defined: any = {
        def: definition,
        pluginName: "",
        get store() {
            return store;
        },
        get plain() {
            return plain;
        },
        use(_paths?: string[]) {
            const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);
            React.useEffect(() => {
                listeners.add(forceUpdate);
                return () => {
                    listeners.delete(forceUpdate);
                };
            }, []);
            return store;
        },
        withPrivateSettings() {
            return defined;
        },
    };

    return defined;
}
