/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Pure state helpers for PersistentThreads.
 *
 * This module intentionally has no dependency on Discord or Vencord so the
 * persistence rules can be unit tested outside of the client.
 */

import { STATE_VERSION } from "./constants";
import type { PersistentThreadsState,PinnedThread } from "./types";

export interface NormalizeResult {
    state: PersistentThreadsState;
    /** True when the input did not match the current schema and should be rewritten */
    changed: boolean;
    /** Number of records that were dropped because they were invalid or duplicated */
    droppedCount: number;
}

export function createEmptyState(): PersistentThreadsState {
    return { version: STATE_VERSION, items: [] };
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.length > 0;
}

function toFiniteNumber(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function sortPinnedThreads(items: readonly PinnedThread[]): PinnedThread[] {
    return [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.pinnedAt - b.pinnedAt);
}

/**
 * Turns any persisted value (including corrupted or legacy data) into a valid
 * state object. Never throws and never mutates the input.
 */
export function normalizeState(raw: unknown): NormalizeResult {
    const empty = createEmptyState();

    if (raw == null) return { state: empty, changed: false, droppedCount: 0 };

    // Legacy/hand written shape: a bare array instead of { version, items }
    const legacyShape = Array.isArray(raw);
    const candidateItems: unknown = legacyShape ? raw : (raw as any).items;

    if (!Array.isArray(candidateItems)) {
        return { state: empty, changed: true, droppedCount: 0 };
    }

    const seen = new Set<string>();
    const items: PinnedThread[] = [];
    let droppedCount = 0;

    for (const [index, entry] of candidateItems.entries()) {
        if (entry == null || typeof entry !== "object") {
            droppedCount++;
            continue;
        }

        const record = entry as Record<string, unknown>;
        if (!isNonEmptyString(record.threadId) || !isNonEmptyString(record.guildId)) {
            droppedCount++;
            continue;
        }

        // A thread may only be pinned once, keep the first record
        if (seen.has(record.threadId)) {
            droppedCount++;
            continue;
        }
        seen.add(record.threadId);

        items.push({
            threadId: record.threadId,
            guildId: record.guildId,
            parentChannelId: isNonEmptyString(record.parentChannelId) ? record.parentChannelId : "",
            pinnedAt: toFiniteNumber(record.pinnedAt, index),
            sortOrder: toFiniteNumber(record.sortOrder, index),
        });
    }

    const sorted = sortPinnedThreads(items);

    // Always persist a dense, stable sortOrder
    let reindexed = false;
    const dense = sorted.map((item, index) => {
        if (item.sortOrder === index) return item;
        reindexed = true;
        return { ...item, sortOrder: index };
    });

    const version = toFiniteNumber((raw as any).version, STATE_VERSION);
    const changed = legacyShape
        || version !== STATE_VERSION
        || droppedCount > 0
        || reindexed
        || !Array.isArray((raw as any).items);

    return { state: { version: STATE_VERSION, items: dense }, changed, droppedCount };
}

export function getGuildItems(state: PersistentThreadsState, guildId: string): PinnedThread[] {
    return sortPinnedThreads(state.items.filter(item => item.guildId === guildId));
}

export interface NewPinnedThread {
    threadId: string;
    guildId: string;
    parentChannelId: string;
    pinnedAt: number;
}

/**
 * Adds a record at the end of the list.
 * Returns null when the record is invalid or already pinned.
 */
export function addPinnedThread(state: PersistentThreadsState, thread: NewPinnedThread): PersistentThreadsState | null {
    if (!isNonEmptyString(thread.threadId) || !isNonEmptyString(thread.guildId)) return null;
    if (state.items.some(item => item.threadId === thread.threadId)) return null;

    const nextSortOrder = state.items.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;

    return {
        version: STATE_VERSION,
        items: [
            ...state.items,
            {
                threadId: thread.threadId,
                guildId: thread.guildId,
                parentChannelId: thread.parentChannelId ?? "",
                pinnedAt: thread.pinnedAt,
                sortOrder: nextSortOrder,
            },
        ],
    };
}

export function removePinnedThreads(state: PersistentThreadsState, threadIds: readonly string[]): { state: PersistentThreadsState; removed: number; } {
    if (threadIds.length === 0) return { state, removed: 0 };

    const remove = new Set(threadIds);
    const items = state.items.filter(item => !remove.has(item.threadId));

    return {
        state: { version: STATE_VERSION, items },
        removed: state.items.length - items.length,
    };
}

/**
 * Merges pinned threads into a per-guild thread map returned by
 * ActiveJoinedThreadsStore, so Discord renders them under their parent channel
 * exactly like a normal, active thread.
 *
 * The input is never mutated: a shallow copy of the affected branches is created
 * only when something is actually added.
 */
export function mergePinnedThreadsIntoGuildMap(
    base: Record<string, Record<string, { channel: unknown; joinTimestamp: number; }>>,
    pinned: readonly { threadId: string; parentChannelId: string; pinnedAt: number; }[],
    resolveChannel: (threadId: string) => { id: string; parent_id?: string | null; } | null | undefined,
    resolveJoinTimestamp: (threadId: string) => number | undefined
): Record<string, Record<string, { channel: unknown; joinTimestamp: number; }>> | null {
    let result: typeof base | null = null;

    for (const item of pinned) {
        const channel = resolveChannel(item.threadId);
        if (channel == null) continue;

        const parentId = channel.parent_id ?? item.parentChannelId;
        if (!parentId) continue;

        const currentParent = result?.[parentId] ?? base[parentId];
        // Already shown natively (e.g. the user joined it and it is active): leave Discord's entry alone
        if (currentParent != null && item.threadId in currentParent) continue;

        result ??= { ...base };
        result[parentId] = {
            ...(result[parentId] ?? base[parentId] ?? {}),
            [item.threadId]: {
                channel,
                joinTimestamp: resolveJoinTimestamp(item.threadId) ?? item.pinnedAt,
            },
        };
    }

    return result;
}
