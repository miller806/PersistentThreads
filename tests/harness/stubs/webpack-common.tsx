/*
 * Harness stub: @webpack/common
 *
 * Implements the subset of Discord/Vencord modules the plugin touches, using the
 * same method names and signatures as @vencord/discord-types documents.
 */

import * as React from "react";
import { createRoot } from "react-dom/client";

export { createRoot, React };
export const useState = React.useState;
export const useEffect = React.useEffect;

/* ------------------------------------------------------------------ stores */

type Listener = () => void;

class FluxStoreStub {
    private listeners = new Set<Listener>();

    addChangeListener(listener: Listener) {
        this.listeners.add(listener);
    }

    removeChangeListener(listener: Listener) {
        this.listeners.delete(listener);
    }

    emitChange() {
        for (const listener of [...this.listeners]) listener();
    }
}

export interface FakeChannel {
    id: string;
    type: number;
    name: string;
    guild_id?: string;
    parent_id?: string;
    isPrivate?: () => boolean;
}

export const harness = {
    channels: new Map<string, FakeChannel>(),
    guilds: new Map<string, { id: string; name: string; }>(),
    unavailableGuilds: new Set<string>(),
    selectedGuildId: null as string | null,
    selectedChannelId: null as string | null,
    toasts: [] as any[],
    navigation: [] as Array<{ router: string; method: string; args: any[]; }>,
    contextMenus: [] as any[],
    dispatches: [] as any[],
    consoleErrors: [] as any[],

    reset() {
        this.channels.clear();
        this.guilds.clear();
        this.unavailableGuilds.clear();
        this.selectedGuildId = null;
        this.selectedChannelId = null;
        this.toasts = [];
        this.navigation = [];
        this.contextMenus = [];
        this.dispatches = [];
    },

    setChannel(channel: FakeChannel) {
        this.channels.set(channel.id, channel);
        ChannelStore.emitChange();
    },

    removeChannel(id: string) {
        this.channels.delete(id);
        ChannelStore.emitChange();
    },
};

class ChannelStoreStub extends FluxStoreStub {
    getChannel(id: string) {
        return harness.channels.get(id);
    }

    hasChannel(id: string) {
        return harness.channels.has(id);
    }

    getChannelIds() {
        return [...harness.channels.keys()];
    }
}

class GuildStoreStub extends FluxStoreStub {
    getGuild(id: string) {
        return harness.guilds.get(id);
    }

    getGuilds() {
        return Object.fromEntries(harness.guilds);
    }
}

class GuildChannelStoreStub extends FluxStoreStub {
    /** Guilds whose channels have been loaded */
    loadedGuilds = new Set<string>();

    hasChannels(guildId: string) {
        return this.loadedGuilds.has(guildId);
    }
}

class GuildAvailabilityStoreStub extends FluxStoreStub {
    isUnavailable(guildId: string | null | undefined) {
        return guildId != null && harness.unavailableGuilds.has(guildId);
    }
}

class SelectedGuildStoreStub extends FluxStoreStub {
    getGuildId() {
        return harness.selectedGuildId;
    }
}

class JoinedThreadsStoreStub extends FluxStoreStub {
    private joinTimestamps = new Map<string, number>();

    joinTimestamp(channelId: string) {
        const value = this.joinTimestamps.get(channelId);
        return value == null ? undefined : new Date(value);
    }

    setJoinTimestamp(channelId: string, ms: number) {
        this.joinTimestamps.set(channelId, ms);
    }

    reset() {
        this.joinTimestamps.clear();
    }
}

class LocaleStoreStub extends FluxStoreStub {
    locale = "en";
    systemLocale = "en";
}

class SelectedChannelStoreStub extends FluxStoreStub {
    getChannelId() {
        return harness.selectedChannelId;
    }
}

export const ChannelStore = new ChannelStoreStub();
export const GuildStore = new GuildStoreStub();
export const GuildChannelStore = new GuildChannelStoreStub();
export const GuildAvailabilityStore = new GuildAvailabilityStoreStub();
export const SelectedGuildStore = new SelectedGuildStoreStub();
export const SelectedChannelStore = new SelectedChannelStoreStub();
export const LocaleStore = new LocaleStoreStub();
export const JoinedThreadsStore = new JoinedThreadsStoreStub();

/**
 * Same contract as Discord's useStateFromStores: re-render on store change.
 * The harness recomputes the mapper on every render (no memoisation), which is
 * sufficient for behavioural assertions.
 */
export function useStateFromStores<T>(
    stores: any[],
    mapper: () => T,
    _dependencies?: any,
    _isEqual?: (old: T, newer: T) => boolean
): T {
    const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);

    React.useEffect(() => {
        const listener = () => forceUpdate();
        for (const store of stores) store?.addChangeListener?.(listener);

        return () => {
            for (const store of stores) store?.removeChangeListener?.(listener);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return mapper();
}

/* --------------------------------------------------------------- utilities */

export function showToast(data: any) {
    harness.toasts.push(data);
}

export const ChannelRouter = {
    transitionToChannel(channelId: string) {
        harness.navigation.push({ router: "ChannelRouter", method: "transitionToChannel", args: [channelId] });
    },
    transitionToThread(channel: any) {
        harness.navigation.push({ router: "ChannelRouter", method: "transitionToThread", args: [channel] });
    },
};

export const NavigationRouter = {
    transitionTo(path: string, ...args: any[]) {
        harness.navigation.push({ router: "NavigationRouter", method: "transitionTo", args: [path, ...args] });
    },
    transitionToGuild(guildId: string, ...args: any[]) {
        harness.navigation.push({ router: "NavigationRouter", method: "transitionToGuild", args: [guildId, ...args] });
    },
    back() { },
    forward() { },
};

export const FluxDispatcher = {
    dispatch(payload: any) {
        harness.dispatches.push(payload);
    },
};

export const ContextMenuApi = {
    closeContextMenu() {
        harness.dispatches.push({ type: "CONTEXT_MENU_CLOSE" });
    },
    openContextMenu(event: any, render?: any) {
        harness.contextMenus.push({ event, render });
    },
    openContextMenuLazy(event: any, renderLazy?: any) {
        harness.contextMenus.push({ event, renderLazy });
    },
};

/* -------------------------------------------------------------------- menu */

function MenuRoot({ children, navId }: any) {
    return <div data-menu-nav-id={navId}>{children}</div>;
}

function MenuItem({ id, label, action, disabled, color }: any) {
    return (
        <div
            data-menu-item={id}
            data-menu-color={color}
            data-menu-disabled={disabled ? "true" : undefined}
            onClick={disabled ? undefined : action}
        >
            {label}
        </div>
    );
}

export const Menu = {
    Menu: MenuRoot,
    MenuItem,
    MenuSeparator: () => <hr data-menu-separator="" />,
    MenuGroup: ({ children, label }: any) => <div data-menu-group={label}>{children}</div>,
    MenuCheckboxItem: MenuItem,
    MenuRadioItem: MenuItem,
    MenuControlItem: MenuItem,
    MenuSearchControl: () => null,
    MenuSliderControl: () => null,
};

/* -------------------------------------------------------------- components */

export const Clickable = ({ children, ...props }: any) => <div {...props}>{children}</div>;
export const Tooltip = ({ children }: any) => (typeof children === "function" ? children({}) : children);
