/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { LocaleStore } from "@webpack/common";

import { getLabelLanguage } from "./settings";

type Language = "en" | "zh";

const USER_FACING_STRINGS = {
    en: {
        pin: "Pin to Channel",
        unpin: "Unpin from Channel",
        pinFailed: (name: string) => `Could not pin "${name}": it is not a thread you can access`,
        unpinThread: (name: string) => `Unpin ${name}`,
        unavailable: "Unavailable",
        loading: "Loading…",
        guildUnavailable: "Server unavailable",
        manageTitle: "Pinned threads",
        manageHint: "Pinned threads stay visible under their parent channel, even when Discord would hide them for being inactive.",
        manageEmpty: "Nothing pinned yet. Right click a thread and choose \"Pin to Channel\".",
        removeInvalid: "Remove unavailable entries",
        removeAll: "Remove all pinned threads",
        removedInvalid: (count: number) => `Removed ${count} unavailable entr${count === 1 ? "y" : "ies"}`,
        noInvalid: "No unavailable entries found",
        parentPrefix: "in",
        patchFailed: "PersistentThreads could not patch the Discord thread list. The pins are saved but threads may not stay visible until Discord/Equicord is updated.",
    },
    zh: {
        pin: "固定到频道",
        unpin: "从频道取消固定",
        pinFailed: (name: string) => `无法固定“${name}”：它不是你当前可以访问的子区`,
        unpinThread: (name: string) => `取消固定 ${name}`,
        unavailable: "不可用",
        loading: "载入中…",
        guildUnavailable: "服务器不可用",
        manageTitle: "固定子区",
        manageHint: "固定后的子区会一直显示在它所属的频道下面，即使 Discord 因为长期不活跃而想把它藏起来。",
        manageEmpty: "还没有固定任何子区。在子区上右键，选择「固定到频道」。",
        removeInvalid: "清理失效项",
        removeAll: "清空全部固定子区",
        removedInvalid: (count: number) => `已清理 ${count} 个失效项`,
        noInvalid: "没有发现失效项",
        parentPrefix: "位于",
        patchFailed: "PersistentThreads 未能注入 Discord 的子区列表。固定记录已保存，但在 Discord / Equicord 更新前子区可能仍会被隐藏。",
    }
};

export type Strings = typeof USER_FACING_STRINGS.en;

function detectLanguage(): Language {
    try {
        const locale = LocaleStore?.locale;
        if (typeof locale === "string" && locale.toLowerCase().startsWith("zh")) return "zh";
    } catch {
        // LocaleStore may not be initialised yet, fall through to english
    }

    return "en";
}

export function getStrings(): Strings {
    const preference = getLabelLanguage();
    if (preference === "zh") return USER_FACING_STRINGS.zh;
    if (preference === "en") return USER_FACING_STRINGS.en;

    return USER_FACING_STRINGS[detectLanguage()];
}
