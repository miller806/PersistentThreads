/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Headless unit tests for the pure persistence / merge logic.
 *
 * Run from the Equicord repository root:
 *   npx tsx src/userplugins/PersistentThreads/__tests__/pure.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { STATE_VERSION } from "../constants";
import {
    addPinnedThread,
    createEmptyState,
    getGuildItems,
    mergePinnedThreadsIntoGuildMap,
    normalizeState,
    removePinnedThreads,
    sortPinnedThreads,
} from "../pure";
import type { PersistentThreadsState,PinnedThread } from "../types";

function thread(threadId: string, guildId = "g1", sortOrder = 0, pinnedAt = 0): PinnedThread {
    return { threadId, guildId, parentChannelId: "p1", pinnedAt, sortOrder };
}

function state(items: PinnedThread[]): PersistentThreadsState {
    return { version: STATE_VERSION, items };
}

describe("normalizeState", () => {
    it("returns an empty state for null/undefined without marking it changed", () => {
        assert.deepEqual(normalizeState(null), { state: createEmptyState(), changed: false, droppedCount: 0 });
        assert.deepEqual(normalizeState(undefined), { state: createEmptyState(), changed: false, droppedCount: 0 });
    });

    it("resets non-object garbage", () => {
        for (const garbage of ["nope", 42, true, { items: "nope" }]) {
            const { state: result, changed } = normalizeState(garbage);
            assert.equal(changed, true);
            assert.deepEqual(result.items, []);
        }
    });

    it("migrates the legacy bare-array shape", () => {
        const { state: result, changed } = normalizeState([
            { threadId: "t1", guildId: "g1", parentChannelId: "p1", pinnedAt: 5, sortOrder: 0 },
        ]);

        assert.equal(changed, true);
        assert.equal(result.version, STATE_VERSION);
        assert.equal(result.items.length, 1);
        assert.equal(result.items[0].threadId, "t1");
    });

    it("drops records with missing ids and reports the count", () => {
        const { state: result, droppedCount } = normalizeState({
            version: STATE_VERSION,
            items: [
                { guildId: "g1" },
                { threadId: "t1" },
                null,
                "string",
                { threadId: "t2", guildId: "g1", parentChannelId: "p1", pinnedAt: 1, sortOrder: 0 },
            ],
        });

        assert.equal(droppedCount, 4);
        assert.deepEqual(result.items.map(item => item.threadId), ["t2"]);
    });

    it("deduplicates by thread id keeping the first record", () => {
        const first = thread("t1", "g1", 0, 100);
        const duplicate = thread("t1", "g1", 1, 200);

        const { state: result, droppedCount } = normalizeState(state([first, duplicate]));

        assert.equal(droppedCount, 1);
        assert.equal(result.items.length, 1);
        assert.equal(result.items[0].pinnedAt, 100);
    });

    it("repairs a non dense or unordered sortOrder", () => {
        const messy = state([
            thread("t3", "g1", 9, 3),
            thread("t1", "g1", 4, 1),
            thread("t2", "g1", 7, 2),
        ]);

        const { state: result, changed } = normalizeState(messy);

        assert.equal(changed, true);
        assert.deepEqual(result.items.map(item => item.threadId), ["t1", "t2", "t3"]);
        assert.deepEqual(result.items.map(item => item.sortOrder), [0, 1, 2]);
    });

    it("is idempotent for already valid data", () => {
        const valid = state([thread("t1", "g1", 0), thread("t2", "g1", 1)]);
        const first = normalizeState(valid);

        assert.equal(first.changed, false);
        assert.deepEqual(normalizeState(first.state).state, first.state);
    });

    it("never mutates its input", () => {
        const input = state([{ ...thread("t2", "g1", 5) }, { ...thread("t1", "g1", 1) }]);
        const snapshot = JSON.parse(JSON.stringify(input));

        normalizeState(input);
        assert.deepEqual(input, snapshot);
    });
});

describe("addPinnedThread", () => {
    it("appends after existing records", () => {
        const base = state([thread("t1", "g1", 0)]);
        const next = addPinnedThread(base, { threadId: "t2", guildId: "g1", parentChannelId: "p1", pinnedAt: 10 });

        assert.ok(next);
        assert.deepEqual(next.items.map(item => item.threadId), ["t1", "t2"]);
        assert.equal(next.items[1].sortOrder, 1);
    });

    it("rejects duplicates (FR-007)", () => {
        const base = state([thread("t1", "g1", 0)]);
        assert.equal(addPinnedThread(base, { threadId: "t1", guildId: "g1", parentChannelId: "p1", pinnedAt: 1 }), null);
    });

    it("rejects invalid ids", () => {
        const base = createEmptyState();
        assert.equal(addPinnedThread(base, { threadId: "", guildId: "g1", parentChannelId: "p1", pinnedAt: 1 }), null);
        assert.equal(addPinnedThread(base, { threadId: "t1", guildId: "", parentChannelId: "p1", pinnedAt: 1 }), null);
    });

    it("supports many entries across guilds (FR-008 / FR-102)", () => {
        let current = createEmptyState();
        for (let i = 0; i < 5; i++) {
            const next = addPinnedThread(current, {
                threadId: `t${i}`,
                guildId: i % 2 === 0 ? "g1" : "g2",
                parentChannelId: "p1",
                pinnedAt: i,
            });
            assert.ok(next);
            current = next;
        }

        assert.equal(current.items.length, 5);
        assert.deepEqual(getGuildItems(current, "g1").map(item => item.threadId), ["t0", "t2", "t4"]);
        assert.deepEqual(getGuildItems(current, "g2").map(item => item.threadId), ["t1", "t3"]);
    });
});

describe("removePinnedThreads", () => {
    it("removes only the requested records", () => {
        const base = state([thread("t1", "g1", 0), thread("t2", "g1", 1), thread("t3", "g2", 2)]);
        const { state: next, removed } = removePinnedThreads(base, ["t2"]);

        assert.equal(removed, 1);
        assert.deepEqual(next.items.map(item => item.threadId), ["t1", "t3"]);
    });

    it("is a no-op for unknown ids", () => {
        const base = state([thread("t1", "g1", 0)]);
        const { removed } = removePinnedThreads(base, ["nope"]);
        assert.equal(removed, 0);
    });

    it("removes many at once (invalid entry cleanup)", () => {
        const base = state([thread("t1", "g1", 0), thread("t2", "g1", 1), thread("t3", "g1", 2)]);
        const { state: next, removed } = removePinnedThreads(base, ["t1", "t3"]);

        assert.equal(removed, 2);
        assert.deepEqual(next.items.map(item => item.threadId), ["t2"]);
    });
});

describe("mergePinnedThreadsIntoGuildMap", () => {
    const pinned = [
        { threadId: "pinned1", parentChannelId: "parent1", pinnedAt: 111 },
        { threadId: "pinned2", parentChannelId: "parent1", pinnedAt: 222 },
        { threadId: "gone", parentChannelId: "parent1", pinnedAt: 333 },
    ];

    const resolveChannel = (threadId: string) => {
        if (threadId === "gone") return null;
        return { id: threadId, parent_id: threadId === "pinned2" ? undefined : "parent1" };
    };

    it("merges pinned threads under their parent channel", () => {
        const merged = mergePinnedThreadsIntoGuildMap({}, pinned, resolveChannel, () => undefined);

        assert.ok(merged);
        assert.deepEqual(Object.keys(merged!), ["parent1"]);
        assert.deepEqual(Object.keys(merged!.parent1).sort(), ["pinned1", "pinned2"]);
        assert.deepEqual(merged!.parent1.pinned1, { channel: { id: "pinned1", parent_id: "parent1" }, joinTimestamp: 111 });
    });

    it("falls back to parentChannelId when the channel has no parent_id", () => {
        const merged = mergePinnedThreadsIntoGuildMap({}, [pinned[1]], resolveChannel, () => undefined);

        assert.ok(merged);
        assert.equal(merged!.parent1.pinned2.joinTimestamp, 222);
    });

    it("uses the real join timestamp when available (keeps native ordering)", () => {
        const merged = mergePinnedThreadsIntoGuildMap({}, [pinned[0]], resolveChannel, threadId => {
            assert.equal(threadId, "pinned1");
            return 999;
        });

        assert.ok(merged);
        assert.equal(merged!.parent1.pinned1.joinTimestamp, 999);
    });

    it("keeps Discord's own entry when the thread is already listed", () => {
        const native = { channel: { id: "pinned1" }, joinTimestamp: 5 };
        const base = { parent1: { pinned1: native } };

        const merged = mergePinnedThreadsIntoGuildMap(base, [pinned[0]], resolveChannel, () => undefined);

        assert.equal(merged, null, "nothing to add, caller keeps the original object");
    });

    it("skips threads that no longer exist", () => {
        const merged = mergePinnedThreadsIntoGuildMap({}, [pinned[2]], resolveChannel, () => undefined);
        assert.equal(merged, null);
    });

    it("does not mutate the base map", () => {
        const base = { other: { native1: { channel: { id: "native1" }, joinTimestamp: 1 } } };
        const snapshot = JSON.parse(JSON.stringify(base));

        mergePinnedThreadsIntoGuildMap(base, pinned, resolveChannel, () => undefined);

        assert.deepEqual(base, snapshot);
    });

    it("handles an empty pin list", () => {
        assert.equal(mergePinnedThreadsIntoGuildMap({}, [], resolveChannel, () => undefined), null);
    });
});

describe("sortPinnedThreads", () => {
    it("is stable for equal sortOrder values", () => {
        const items = [thread("later", "g1", 1, 20), thread("earlier", "g1", 1, 10)];
        assert.deepEqual(sortPinnedThreads(items).map(item => item.threadId), ["earlier", "later"]);
    });
});
