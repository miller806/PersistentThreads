/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import type { Channel } from "@vencord/discord-types";
import { ChannelType } from "@vencord/discord-types/enums";
import {
    ChannelStore,
    FluxDispatcher,
    GuildAvailabilityStore,
    GuildChannelStore,
    GuildStore,
    JoinedThreadsStore,
} from "@webpack/common";

import { STATE_KEY, STATE_VERSION } from "./constants";
import {
    addPinnedThread,
    createEmptyState,
    getGuildItems,
    mergePinnedThreadsIntoGuildMap,
    normalizeState,
    removePinnedThreads,
    sortPinnedThreads,
} from "./pure";
import { settings } from "./settings";
import type { PersistentThreadsState, PinnedThread, ResolvedPinnedThread } from "./types";

const logger = new Logger("PersistentThreads");

/**
 * Supported thread channel types (see @vencord/discord-types ChannelType):
 * ANNOUNCEMENT_THREAD = 10, PUBLIC_THREAD = 11, PRIVATE_THREAD = 12
 */
const THREAD_CHANNEL_TYPES: ReadonlySet<number> = new Set([
    ChannelType.ANNOUNCEMENT_THREAD,
    ChannelType.PUBLIC_THREAD,
    ChannelType.PRIVATE_THREAD,
]);

export function isThreadChannel(channel: Channel | null | undefined): boolean {
    return channel != null && THREAD_CHANNEL_TYPES.has(channel.type);
}

/* ------------------------------------------------------------------ state io */

// The patched Discord getter is called for every channel list build, so cache the
// parsed state and only re-parse when the settings object identity changes.
let cachedRawState: unknown;
let cachedItems: PinnedThread[] = [];

function getCachedItems(): PinnedThread[] {
    let raw: unknown;
    try {
        raw = settings.store[STATE_KEY];
    } catch (error) {
        logger.error("Failed to read pinned thread state", error);
        return [];
    }

    if (raw !== cachedRawState) {
        cachedRawState = raw;
        cachedItems = normalizeState(raw).state.items;
    }

    return cachedItems;
}

/** Reads the current state (validated, never throws). */
export function getState(): PersistentThreadsState {
    return { version: STATE_VERSION, items: getCachedItems() };
}

function writeState(state: PersistentThreadsState) {
    try {
        settings.store[STATE_KEY] = { version: STATE_VERSION, items: state.items };
    } catch (error) {
        logger.error("Failed to persist pinned thread state", error);
    }
}

/** Validates persisted data and rewrites it once if it needed repairs. */
export function migrateState() {
    try {
        const { state, changed, droppedCount } = normalizeState(settings.store[STATE_KEY]);
        if (changed) {
            if (droppedCount > 0) {
                logger.warn(`Dropped ${droppedCount} invalid pinned thread record(s) while migrating`);
            }
            settings.store[STATE_KEY] = state;
        }
    } catch (error) {
        logger.error("Failed to migrate pinned thread state", error);
    }
}

export function isPinned(threadId: string | null | undefined): boolean {
    if (!threadId) return false;
    return getCachedItems().some(item => item.threadId === threadId);
}

export function getGuildPinnedThreads(guildId: string | null | undefined): PinnedThread[] {
    if (!guildId) return [];
    return getGuildItems(getState(), guildId);
}

export function getPinnedThreadsForParent(parentChannelId: string): PinnedThread[] {
    return sortPinnedThreads(getCachedItems().filter(item => item.parentChannelId === parentChannelId));
}

/* ---------------------------------------------------------------- mutations */

/**
 * Makes Discord rebuild its channel list rows so a pin/unpin takes effect
 * immediately. `CHANNEL_UPDATES` is the same event Discord's gateway sends, and
 * GuildChannelStore uses it to invalidate its cached rows.
 */
export function refreshChannelList(channels: Array<Channel | null | undefined>) {
    const payload = channels.filter((channel): channel is Channel => channel != null && channel.guild_id != null);
    if (payload.length === 0) return;

    try {
        FluxDispatcher.dispatch({ type: "CHANNEL_UPDATES", channels: payload });
    } catch (error) {
        logger.error("Failed to refresh the Discord channel list", error);
    }
}

/** Pins a thread. Returns false when the channel is not a pinnable thread. */
export function pinThread(channel: Channel | null | undefined): boolean {
    if (channel == null || !isThreadChannel(channel)) return false;

    const guildId = channel.guild_id;
    if (!guildId) return false;

    const next = addPinnedThread(getState(), {
        threadId: channel.id,
        guildId,
        parentChannelId: channel.parent_id ?? "",
        pinnedAt: Date.now(),
    });

    if (next == null) return false;

    writeState(next);
    refreshChannelList([channel]);
    return true;
}

export function unpinThread(threadId: string): boolean {
    const channel = ChannelStore.getChannel(threadId) ?? null;
    const { state, removed } = removePinnedThreads(getState(), [threadId]);
    if (removed === 0) return false;

    writeState(state);
    refreshChannelList([channel]);
    return true;
}

export function unpinMany(threadIds: readonly string[]): number {
    const { state, removed } = removePinnedThreads(getState(), threadIds);
    if (removed === 0) return 0;

    const channels = threadIds.map(threadId => {
        try {
            return ChannelStore.getChannel(threadId) ?? null;
        } catch {
            return null;
        }
    });

    writeState(state);
    refreshChannelList(channels);
    return removed;
}

export function clearAll(): void {
    const channels = getCachedItems()
        .map(item => ChannelStore.getChannel(item.threadId) ?? ChannelStore.getChannel(item.parentChannelId) ?? null)
        .filter((channel): channel is Channel => channel != null);

    writeState(createEmptyState());
    refreshChannelList(channels);
}

/* ------------------------------------------------------------ discord bridge */

/**
 * Bridge used by the ActiveJoinedThreadsStore patch.
 *
 * Discord only renders threads that are "active/joined/relevant" under their
 * parent channel. We merge the user's pinned threads into that map, which makes
 * Discord render them natively (same row, same navigation, same context menus).
 */
export function withPinnedThreads(
    guildId: string,
    base: Record<string, Record<string, { channel: unknown; joinTimestamp: number; }>>
) {
    try {
        const pinned = getGuildPinnedThreads(guildId);
        if (pinned.length === 0) return base;

        const merged = mergePinnedThreadsIntoGuildMap(
            base ?? {},
            pinned,
            threadId => {
                try {
                    return ChannelStore.getChannel(threadId) ?? null;
                } catch {
                    return null;
                }
            },
            threadId => {
                try {
                    return JoinedThreadsStore?.joinTimestamp?.(threadId)?.getTime?.();
                } catch {
                    return undefined;
                }
            }
        );

        return merged ?? base;
    } catch (error) {
        logger.error("Failed to merge pinned threads into the Discord thread list", error);
        return base;
    }
}

/* --------------------------------------------------------------- resolution */

/** Resolves a pinned record against the live Discord stores. */
export function resolvePinnedThread(item: PinnedThread): ResolvedPinnedThread {
    let channel: Channel | null = null;
    try {
        channel = ChannelStore.getChannel(item.threadId) ?? null;
    } catch (error) {
        logger.error("Failed to read a pinned thread from the ChannelStore", error);
    }

    if (channel == null) {
        return {
            item,
            channel: null,
            name: "",
            parentName: null,
            status: resolveMissingStatus(item.guildId),
        };
    }

    const parentId = channel.parent_id ?? item.parentChannelId;
    let parent: Channel | null = null;

    if (parentId) {
        try {
            parent = ChannelStore.getChannel(parentId) ?? null;
        } catch (error) {
            logger.error("Failed to read a pinned thread's parent channel", error);
        }
    }

    return {
        item,
        channel,
        name: channel.name || "",
        parentName: parent?.name ?? null,
        status: "ok",
    };
}

/**
 * Distinguishes "this guild has not been loaded yet" from "this thread is gone":
 * on startup ChannelStore has no channels for a guild until it is loaded.
 */
function resolveMissingStatus(guildId: string): ResolvedPinnedThread["status"] {
    if (!isGuildAvailable(guildId)) return "guildUnavailable";
    if (!hasGuildChannelsLoaded(guildId)) return "loading";

    return "unavailable";
}

function hasGuildChannelsLoaded(guildId: string): boolean {
    try {
        return GuildChannelStore.hasChannels(guildId);
    } catch {
        // If the store is unavailable, prefer the honest "unavailable" label
        return true;
    }
}

export function isGuildAvailable(guildId: string): boolean {
    try {
        if (GuildAvailabilityStore.isUnavailable(guildId)) return false;
        return GuildStore.getGuild(guildId) != null;
    } catch {
        return false;
    }
}

export function resolveAllPinnedThreads(state: PersistentThreadsState): ResolvedPinnedThread[] {
    return sortPinnedThreads(state?.items ?? []).map(resolvePinnedThread);
}

/** Comparator used to avoid re-rendering the settings panel on unrelated store changes. */
export function areResolvedThreadsEqual(a: ResolvedPinnedThread[], b: ResolvedPinnedThread[]): boolean {
    if (a === b) return true;
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
        const left = a[i];
        const right = b[i];

        if (
            left.item.threadId !== right.item.threadId
            || left.item.sortOrder !== right.item.sortOrder
            || left.name !== right.name
            || left.parentName !== right.parentName
            || left.status !== right.status
        ) return false;
    }

    return true;
}
