/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Channel } from "@vencord/discord-types";

/** A single pinned thread record. Names are intentionally NOT stored, they are read live. */
export interface PinnedThread {
    threadId: string;
    guildId: string;
    parentChannelId: string;
    pinnedAt: number;
    sortOrder: number;
}

/** Versioned top level state that is persisted in the plugin settings. */
export interface PersistentThreadsState {
    version: number;
    items: PinnedThread[];
}

/**
 * One entry of ActiveJoinedThreadsStore's per-guild/per-parent thread maps,
 * as read from the real Discord bundle.
 */
export interface DiscordThreadListEntry {
    channel: Channel;
    joinTimestamp: number;
}

/** per guild -> per parent channel -> per thread */
export type DiscordGuildThreadMap = Record<string, Record<string, DiscordThreadListEntry>>;

/** How a pinned record resolves against the current Discord state. */
export type PinnedThreadStatus = "ok" | "loading" | "unavailable" | "guildUnavailable";

/** A pinned record resolved against the live stores (used by the settings panel). */
export interface ResolvedPinnedThread {
    item: PinnedThread;
    channel: Channel | null;
    /** Live thread name, empty when the thread is gone. */
    name: string;
    /** Live parent channel name, or null when unknown. */
    parentName: string | null;
    status: PinnedThreadStatus;
}
