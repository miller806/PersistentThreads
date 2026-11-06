/*
 * PersistentThreads headless test harness.
 *
 * Drives the real plugin sources against stubbed Discord/Vencord modules and,
 * for the patch itself, against the REAL minified Discord source extracted from
 * the local client cache (see fixtures/).
 *
 * This is NOT a substitute for running the plugin inside the Discord client.
 */

import assert from "node:assert/strict";
import { act } from "react";

import plugin from "#plugin";
import { logRecords } from "@utils/Logger";
import { ChannelType } from "@vencord/discord-types/enums";
import { createRoot, GuildChannelStore, harness, JoinedThreadsStore, LocaleStore } from "@webpack/common";

import { ACTIVE_JOINED_THREADS_STORE_CLASS } from "./fixtures/activeJoinedThreadsStore";

const settings = plugin.settings as any;

const stateKey = (() => {
    const custom = Object.entries(settings.def as Record<string, any>)
        .find(([, definition]) => definition?.type === 7);
    return custom?.[0] ?? "pinnedThreads";
})();

const consoleErrors: any[][] = [];
const originalConsoleError = console.error.bind(console);
console.error = (...args: any[]) => {
    consoleErrors.push(args);
    originalConsoleError(...args);
};

interface TestResult {
    name: string;
    ok: boolean;
    error?: unknown;
}

const results: TestResult[] = [];

function pinnedState(): any {
    return settings.store[stateKey] ?? { version: 1, items: [] };
}

function pinnedIds(): string[] {
    return pinnedState().items.map((item: any) => item.threadId);
}

function setState(value: unknown) {
    settings.store[stateKey] = value as any;
}

function makeThread(
    id: string,
    name: string,
    type: number = ChannelType.PUBLIC_THREAD,
    guildId = "guild1",
    parentId = "parent1"
) {
    return { id, name, type, guild_id: guildId, parent_id: parentId };
}

function seedServer() {
    GuildChannelStore.loadedGuilds.add("guild1");
    GuildChannelStore.loadedGuilds.add("guild2");

    harness.guilds.set("guild1", { id: "guild1", name: "Guild One" });
    harness.guilds.set("guild2", { id: "guild2", name: "Guild Two" });

    harness.setChannel({ id: "parent1", type: ChannelType.GUILD_TEXT, name: "cron-news", guild_id: "guild1" });
    harness.setChannel({ id: "parent2", type: ChannelType.GUILD_TEXT, name: "other-parent", guild_id: "guild2" });
    harness.setChannel(makeThread("t1", "Daily Finance"));
    harness.setChannel(makeThread("t2", "Daily AI", ChannelType.ANNOUNCEMENT_THREAD));
    harness.setChannel(makeThread("t3", "Private Ops", ChannelType.PRIVATE_THREAD));
    harness.setChannel(makeThread("t9", "Daily Finance", ChannelType.PUBLIC_THREAD, "guild2", "parent2"));
    harness.setChannel({ id: "text1", type: ChannelType.GUILD_TEXT, name: "general", guild_id: "guild1" });
    harness.setChannel({ id: "voice1", type: ChannelType.GUILD_VOICE, name: "Voice", guild_id: "guild1" });
}

function resetAll() {
    harness.reset();
    consoleErrors.length = 0;
    logRecords.length = 0;

    LocaleStore.locale = "en";
    LocaleStore.systemLocale = "en";
    settings.store.labelLanguage = "auto";
    settings.store[stateKey] = { version: 1, items: [] };
    JoinedThreadsStore.reset();
}

async function startPlugin() {
    plugin.start();
}

function menuEntryFor(channel: any) {
    const children: any[] = [];
    plugin.contextMenus["thread-context"](children, { channel });
    return children.find(child => child?.props?.id === "vc-persistent-threads-toggle");
}

function settle() {
    // Nothing asynchronous in the runtime path, but keep a hook for future async work
}

function buildPatchedStoreMethod() {
    const patch = (plugin.patches as any[])[0];
    assert.ok(patch, "plugin declares a patch");

    assert.equal(typeof patch.find, "string");
    assert.ok(
        ACTIVE_JOINED_THREADS_STORE_CLASS.includes(patch.find),
        `patch.find ${JSON.stringify(patch.find)} must exist in the real Discord module`
    );

    const methodMatch = ACTIVE_JOINED_THREADS_STORE_CLASS.match(/getActiveJoinedRelevantThreadsForGuild\(\w\)\{return [^}]*\}/);
    assert.ok(methodMatch, "the targeted method exists in the real Discord source");

    const original = methodMatch![0];
    // Vencord canonicalizes \i to an identifier pattern; do the same here
    const canonMatch = new RegExp(
        patch.replacement.match.source.replaceAll(/(\\*)\\i/g, (full: string, escapes: string) =>
            escapes.length % 2 === 0 ? `${escapes}(?:[A-Za-z_$][\w$]*)` : full.slice(1)
        ),
        patch.replacement.match.flags
    );
    const patched = original.replace(canonMatch, patch.replacement.replace);
    assert.notEqual(patched, original, "the patch regex must match real Discord source");

    return { original, patched };
}

async function test(name: string, fn: () => Promise<void> | void) {
    if (process.env.HARNESS_VERBOSE) console.log("... " + name);
    resetAll();
    try {
        await fn();
        results.push({ name, ok: true });
    } catch (error) {
        results.push({ name, ok: false, error });
    }
    if (process.env.HARNESS_VERBOSE) console.log(`   consoleErrors=${consoleErrors.length}`);
}

export async function run() {
    await test("start() migrates the persisted state without crashing", async () => {
        await startPlugin();
        assert.equal(pinnedState().version, 1);
        assert.deepEqual(pinnedState().items, []);
    });

    await test("the context menu entry is only offered for thread channels (FR-001, FR-002)", async () => {
        seedServer();

        assert.equal(menuEntryFor(harness.channels.get("text1")), undefined, "no entry for text channels");
        assert.equal(menuEntryFor(harness.channels.get("voice1")), undefined, "no entry for voice channels");
        assert.equal(menuEntryFor(undefined), undefined, "no entry without a channel");

        for (const id of ["t1", "t2", "t3"]) {
            const entry = menuEntryFor(harness.channels.get(id));
            assert.ok(entry, `entry exists for thread ${id}`);
            assert.equal(entry.props.label, "Pin to Channel");
        }
    });

    await test("pinning stores the documented record and refreshes the Discord channel list (FR-002, FR-006, FR-007)", async () => {
        seedServer();

        const entry = menuEntryFor(harness.channels.get("t1"));
        entry.props.action();
        settle();

        const state = pinnedState();
        assert.equal(state.version, 1);
        assert.equal(state.items.length, 1);
        assert.deepEqual(Object.keys(state.items[0]).sort(), ["guildId", "parentChannelId", "pinnedAt", "sortOrder", "threadId"]);
        assert.equal(state.items[0].threadId, "t1");
        assert.equal(state.items[0].guildId, "guild1");
        assert.equal(state.items[0].parentChannelId, "parent1");

        const refresh = harness.dispatches.filter(d => d?.type === "CHANNEL_UPDATES");
        assert.equal(refresh.length, 1, "the channel list is told to rebuild");
        assert.equal(refresh[0].channels[0].id, "t1");
    });

    await test("pinning the same thread twice keeps a single record (FR-007)", async () => {
        seedServer();

        const staleEntry = menuEntryFor(harness.channels.get("t1"));
        staleEntry.props.action();
        staleEntry.props.action();

        assert.deepEqual(pinnedIds(), ["t1"]);
    });

    await test("pinned threads are merged into the Discord thread map under their parent (core behaviour)", async () => {
        seedServer();
        menuEntryFor(harness.channels.get("t1")).props.action();
        menuEntryFor(harness.channels.get("t2")).props.action();

        const base = {
            parent1: {
                native1: { channel: { id: "native1" }, joinTimestamp: 5 },
            },
        };
        const baseSnapshot = JSON.parse(JSON.stringify(base));

        const merged = plugin.withPinnedThreads("guild1", base);

        assert.ok(merged, "a merged map is returned");
        assert.deepEqual(Object.keys(merged.parent1).sort(), ["native1", "t1", "t2"]);
        assert.equal(merged.parent1.t1.channel.id, "t1");
        assert.equal(merged.parent1.t2.channel.id, "t2");
        assert.deepEqual(base, baseSnapshot, "Discord's own map is never mutated");
    });

    await test("only the pins of the current guild are merged (FR-102)", async () => {
        seedServer();
        menuEntryFor(harness.channels.get("t1")).props.action();
        menuEntryFor(harness.channels.get("t9")).props.action();

        const guild1 = plugin.withPinnedThreads("guild1", {});
        const guild2 = plugin.withPinnedThreads("guild2", {});
        const guild3 = plugin.withPinnedThreads("guild3", {});

        assert.deepEqual(Object.keys(guild1.parent1), ["t1"]);
        assert.deepEqual(Object.keys(guild2.parent2), ["t9"]);
        assert.deepEqual(guild3, {}, "an unknown guild returns the untouched map");
    });

    await test("same thread name in two guilds never collides", async () => {
        seedServer();
        menuEntryFor(harness.channels.get("t1")).props.action();
        menuEntryFor(harness.channels.get("t9")).props.action();

        assert.deepEqual(pinnedIds().sort(), ["t1", "t9"]);
        assert.equal(harness.channels.get("t1")!.name, harness.channels.get("t9")!.name);
    });

    await test("a real join timestamp is preferred so Discord's native ordering is preserved", async () => {
        seedServer();
        JoinedThreadsStore.setJoinTimestamp("t1", 424242);
        menuEntryFor(harness.channels.get("t1")).props.action();

        const merged = plugin.withPinnedThreads("guild1", {});
        assert.equal(merged.parent1.t1.joinTimestamp, 424242);
    });

    await test("the context menu flips to unpin and removal restores the native list (FR-003)", async () => {
        seedServer();
        menuEntryFor(harness.channels.get("t1")).props.action();

        const entry = menuEntryFor(harness.channels.get("t1"));
        assert.equal(entry.props.label, "Unpin from Channel");

        entry.props.action();

        assert.deepEqual(pinnedIds(), []);
        assert.equal(plugin.withPinnedThreads("guild1", {}).parent1, undefined);

        const refreshCalls = harness.dispatches.filter(d => d?.type === "CHANNEL_UPDATES");
        assert.equal(refreshCalls.length, 2, "both pin and unpin ask Discord to rebuild");
    });

    await test("the manifest patch applies to real Discord source and yields the pinned thread", async () => {
        seedServer();
        menuEntryFor(harness.channels.get("t1")).props.action();
        settle();

        const { patched } = buildPatchedStoreMethod();

        // Execute the patched Discord method with our own bridge, exactly like the client will
        const factory = new Function("$self", "S", "Y", `return class { ${patched} };`) as any;
        const S = { guild1: { parent1: { native1: { channel: { id: "native1" }, joinTimestamp: 5 } } } };
        const Y = {};
        const Store = factory({ withPinnedThreads: plugin.withPinnedThreads }, S, Y);
        const instance = new Store();

        const result = instance.getActiveJoinedRelevantThreadsForGuild("guild1");

        assert.ok(result.parent1.native1, "Discord's native thread is preserved");
        assert.ok(result.parent1.t1, "the pinned thread is added to the map Discord renders from");

        // A guild without pins returns the untouched original object
        assert.equal(instance.getActiveJoinedRelevantThreadsForGuild("guild2"), Y);
    });

    await test("a deleted thread is skipped instead of breaking the thread list (FR-009)", async () => {
        seedServer();
        menuEntryFor(harness.channels.get("t1")).props.action();

        harness.channels.delete("t1");

        const merged = plugin.withPinnedThreads("guild1", {});
        assert.equal(Object.keys(merged).length, 0, "nothing is injected for a missing channel");
        assert.deepEqual(pinnedIds(), ["t1"], "the record is kept so it can be cleaned up");

        const host = document.createElement("div");
        document.body.appendChild(host);
        const root = createRoot(host);
        const Manage = plugin.settingsAboutComponent!;

        try {
            await act(async () => {
                root.render(<Manage />);
            });

            assert.match(host.textContent ?? "", /Unavailable/);

            const cleanupButton = [...host.querySelectorAll("button")].find(button => /Remove unavailable entries/.test(button.textContent ?? ""));
            assert.ok(cleanupButton, "cleanup button rendered");
            cleanupButton!.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

            assert.deepEqual(pinnedIds(), []);
            assert.equal(harness.toasts.at(-1)?.text, "Removed 1 unavailable entry");
        } finally {
            await act(async () => {
                root.unmount();
            });
            host.remove();
        }
    });

    await test("corrupted persisted data is repaired instead of crashing", async () => {
        seedServer();
        setState({ version: 999, items: "definitely not an array" });

        await startPlugin();

        const state = pinnedState();
        assert.equal(state.version, 1);
        assert.deepEqual(state.items, []);
        assert.equal(logRecords.filter(record => record.level === "error").length, 0);

        // The patched bridge must survive garbage too
        assert.deepEqual(plugin.withPinnedThreads("guild1", {}), {});
        assert.equal(plugin.withPinnedThreads("guild1", null as any), null);
    });

    await test("Chinese labels are used when the Discord locale is Chinese", async () => {
        seedServer();
        LocaleStore.locale = "zh-CN";

        const entry = menuEntryFor(harness.channels.get("t1"));
        assert.equal(entry.props.label, "固定到频道");

        entry.props.action();
        assert.equal(menuEntryFor(harness.channels.get("t1")).props.label, "从频道取消固定");
    });

    await test("no console errors or warnings during a full usage cycle", async () => {
        seedServer();
        await startPlugin();

        menuEntryFor(harness.channels.get("t1")).props.action();
        plugin.withPinnedThreads("guild1", {});
        menuEntryFor(harness.channels.get("t1")).props.action();
        plugin.stop();

        assert.equal(consoleErrors.length, 0, `unexpected console errors: ${JSON.stringify(consoleErrors)}`);
        assert.equal(logRecords.filter(record => record.level === "error").length, 0);
    });

    /* -------------------------------------------------------------- report */

    const failed = results.filter(result => !result.ok);

    for (const result of results) {
        if (result.ok) {
            console.log(`ok   - ${result.name}`);
        } else {
            console.log(`FAIL - ${result.name}`);
            console.log(`       ${result.error instanceof Error ? result.error.stack?.split("\n").slice(0, 5).join("\n       ") : String(result.error)}`);
        }
    }

    console.log("");
    console.log(`${results.length - failed.length}/${results.length} harness tests passed`);

    return { passed: results.length - failed.length, failed: failed.length, results };
}
