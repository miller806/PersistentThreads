/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

import { STATE_KEY, STATE_VERSION } from "./constants";
import type { PersistentThreadsState } from "./types";

export const enum LabelLanguage {
    Auto = "auto",
    English = "en",
    Chinese = "zh"
}

const EMPTY_STATE: PersistentThreadsState = { version: STATE_VERSION, items: [] };

export const settings = definePluginSettings({
    [STATE_KEY]: {
        // Hidden bookkeeping setting. Rendered by the plugin's custom settings component instead.
        type: OptionType.CUSTOM,
        default: EMPTY_STATE,
        description: "Pinned thread records. Use the panel above to manage them.",
    },
    labelLanguage: {
        type: OptionType.SELECT,
        description: "Language used for this plugin's UI labels",
        options: [
            { label: "Match Discord", value: LabelLanguage.Auto, default: true },
            { label: "English", value: LabelLanguage.English },
            { label: "中文", value: LabelLanguage.Chinese },
        ],
    },
});

export function getLabelLanguage(): LabelLanguage {
    try {
        return settings.store.labelLanguage ?? LabelLanguage.Auto;
    } catch {
        return LabelLanguage.Auto;
    }
}
