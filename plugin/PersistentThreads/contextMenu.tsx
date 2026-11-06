/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { NavContextMenuPatchCallback } from "@api/ContextMenu";
import type { Channel } from "@vencord/discord-types";
import { Menu, showToast } from "@webpack/common";

import { CloseIcon, PinIcon } from "./components/icons";
import { getStrings } from "./i18n";
import { isPinned, isThreadChannel, pinThread, unpinThread } from "./state";

const TOGGLE_MENU_ITEM_ID = "vc-persistent-threads-toggle";

const togglePinContextMenuPatch: NavContextMenuPatchCallback = (children, ...args) => {
    // Both "channel-context" and "thread-context" receive { channel }
    const channel = (args[0]?.channel ?? null) as Channel | null;
    if (channel == null || !isThreadChannel(channel)) return;

    try {
        if (children.some(child => child?.props?.id === TOGGLE_MENU_ITEM_ID)) return;

        const strings = getStrings();
        const pinned = isPinned(channel.id);
        const threadName = channel.name || channel.id;

        children.push(
            <Menu.MenuItem
                id={TOGGLE_MENU_ITEM_ID}
                label={pinned ? strings.unpin : strings.pin}
                icon={pinned ? CloseIcon : PinIcon}
                action={() => {
                    if (pinned) {
                        unpinThread(channel.id);
                        return;
                    }

                    if (!pinThread(channel)) {
                        showToast({ text: strings.pinFailed(threadName), variant: "critical" });
                    }
                }}
            />
        );
    } catch (error) {
        console.error("[PersistentThreads] Failed to patch the thread context menu", error);
    }
};

export const contextMenuPatch = togglePinContextMenuPatch;
