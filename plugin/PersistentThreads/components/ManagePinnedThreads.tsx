/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
    ChannelStore,
    GuildAvailabilityStore,
    GuildStore,
    showToast,
    useStateFromStores,
} from "@webpack/common";

import { STATE_KEY } from "../constants";
import { getStrings } from "../i18n";
import { settings } from "../settings";
import {
    areResolvedThreadsEqual,
    clearAll,
    isGuildAvailable,
    resolveAllPinnedThreads,
    unpinMany,
} from "../state";
import type { PersistentThreadsState } from "../types";
import { cl, CloseIcon, PinIcon } from "./icons";

export function ManagePinnedThreadsComponent() {
    const strings = getStrings();
    const { pinnedThreads } = settings.use([STATE_KEY]) as { pinnedThreads: PersistentThreadsState; };

    const rows = useStateFromStores(
        [ChannelStore, GuildStore, GuildAvailabilityStore],
        () => resolveAllPinnedThreads(pinnedThreads),
        [pinnedThreads],
        areResolvedThreadsEqual
    );

    const unavailableIds = rows
        .filter(row => row.status === "unavailable" || row.status === "guildUnavailable")
        .map(row => row.item.threadId);

    function handleRemoveInvalid() {
        const removed = unpinMany(unavailableIds);
        showToast({
            text: removed > 0 ? strings.removedInvalid(removed) : strings.noInvalid,
            variant: removed > 0 ? "success" : "default",
        });
    }

    return (
        <div className={cl("manage")}>
            <h3 className={cl("manage-title")}>
                <PinIcon className={cl("header-icon")} />
                <span>{strings.manageTitle}</span>
                <span className={cl("header-count")}>{rows.length}</span>
            </h3>

            <p className={cl("manage-hint")}>{strings.manageHint}</p>

            {rows.length === 0
                ? <p className={cl("manage-empty")}>{strings.manageEmpty}</p>
                : (
                    <div className={cl("manage-list")}>
                        {rows.map(row => {
                            const guildName = (() => {
                                try {
                                    return GuildStore.getGuild(row.item.guildId)?.name ?? row.item.guildId;
                                } catch {
                                    return row.item.guildId;
                                }
                            })();

                            const unavailable = row.status === "unavailable" || row.status === "guildUnavailable";
                            const name = row.status === "ok"
                                ? row.name
                                : row.status === "loading"
                                    ? strings.loading
                                    : isGuildAvailable(row.item.guildId) ? strings.unavailable : strings.guildUnavailable;

                            return (
                                <div
                                    key={row.item.threadId}
                                    className={cl("manage-row", { "row-missing": unavailable })}
                                >
                                    <span className={cl("manage-row-name")} title={name}>
                                        {name}
                                    </span>
                                    {row.parentName && row.status === "ok" && (
                                        <span className={cl("manage-row-parent")} title={row.parentName}>
                                            {strings.parentPrefix} #{row.parentName}
                                        </span>
                                    )}
                                    <span className={cl("manage-row-guild")} title={guildName}>
                                        {guildName}
                                    </span>
                                    <button
                                        type="button"
                                        className={cl("manage-remove")}
                                        aria-label={strings.unpinThread(name)}
                                        title={strings.unpin}
                                        onClick={() => unpinMany([row.item.threadId])}
                                    >
                                        <CloseIcon />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

            <div className={cl("manage-actions")}>
                <button
                    type="button"
                    className={cl("manage-button")}
                    disabled={unavailableIds.length === 0}
                    onClick={handleRemoveInvalid}
                >
                    {strings.removeInvalid}
                </button>
                <button
                    type="button"
                    className={cl("manage-button", "manage-button-danger")}
                    disabled={rows.length === 0}
                    onClick={() => clearAll()}
                >
                    {strings.removeAll}
                </button>
            </div>
        </div>
    );
}
