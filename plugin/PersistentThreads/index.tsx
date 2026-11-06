/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";

import { ManagePinnedThreadsComponent } from "./components/ManagePinnedThreads";
import { contextMenuPatch } from "./contextMenu";
import { settings } from "./settings";
import { migrateState, withPinnedThreads } from "./state";
import managedStyle from "./style.css?managed";

const logger = new Logger("PersistentThreads");

export default definePlugin({
    name: "PersistentThreads",
    description: "Keeps pinned threads visible under their parent channel, even after Discord would hide them for being inactive.",
    tags: ["Organisation", "Servers", "Utility"],
    authors: [{ name: "miller", id: 854964314234814484n }],
    searchTerms: ["thread", "pin", "sidebar", "inactive", "active threads"],
    settings,
    managedStyle,
    settingsAboutComponent: ManagePinnedThreadsComponent,
    contextMenus: {
        // Threads use "thread-context", but some surfaces (e.g. thread lists) fall back to "channel-context"
        "channel-context": contextMenuPatch,
        "thread-context": contextMenuPatch,
    },

    /**
     * Discord renders the threads of a channel from
     * ActiveJoinedThreadsStore.getActiveJoinedRelevantThreadsForGuild(guildId),
     * which only contains joined + recently active threads. Merging our pinned
     * threads into that map makes Discord render them natively under their parent
     * channel: same row component, same navigation, same context menu, no custom UI.
     */
    patches: [
        {
            find: '"ActiveJoinedThreadsStore"',
            replacement: {
                match: /getActiveJoinedRelevantThreadsForGuild\((\i)\)\{return (.+?)\}/,
                replace: "getActiveJoinedRelevantThreadsForGuild($1){return $self.withPinnedThreads($1,$2)}"
            }
        }
    ],

    withPinnedThreads,

    start() {
        migrateState();
        logger.info("PersistentThreads started");
    },

    stop() {
        logger.info("PersistentThreads stopped");
    },
});
