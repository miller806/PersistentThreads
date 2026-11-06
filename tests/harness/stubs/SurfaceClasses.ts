/*
 * Harness stub: @api/SurfaceClasses
 *
 * Mirrors the real API contract: providers are called by Discord owned surfaces,
 * which then spread the returned props (in particular `ref`) onto their DOM node.
 * The harness lets the test act as that surface.
 */

export type SurfaceId =
    | "base"
    | "sidebar"
    | "guildBar"
    | "channelList"
    | "membersList"
    | "titleBar"
    | "headerBar"
    | "userArea";

export interface SurfaceProvidedProps {
    ref?: (element: any) => void;
    style?: Record<string, any>;
    [dataAttribute: `data-${string}`]: string | undefined;
}

export type SurfacePropsProvider = () => SurfaceProvidedProps | undefined;

const providers = new Map<SurfaceId, Set<SurfacePropsProvider>>();
const notifyCounts = new Map<SurfaceId, number>();

export function addSurfacePropsProvider(surfaceId: SurfaceId, provider: SurfacePropsProvider) {
    let set = providers.get(surfaceId);
    if (!set) {
        set = new Set();
        providers.set(surfaceId, set);
    }
    set.add(provider);

    return () => {
        providers.get(surfaceId)?.delete(provider);
    };
}

export function notifySurfaceClassesChanged(surfaceId: SurfaceId) {
    notifyCounts.set(surfaceId, (notifyCounts.get(surfaceId) ?? 0) + 1);
}

/** Harness only: read the providers that a real Discord surface would call */
export function __getProviders(surfaceId: SurfaceId): SurfacePropsProvider[] {
    return [...(providers.get(surfaceId) ?? [])];
}

/** Harness only: how many times notifySurfaceClassesChanged was called */
export function __getNotifyCount(surfaceId: SurfaceId): number {
    return notifyCounts.get(surfaceId) ?? 0;
}

/** Harness only: simulate a Discord surface rendering and consuming the props */
export function __collectProps(surfaceId: SurfaceId): SurfaceProvidedProps {
    const merged: SurfaceProvidedProps = {};

    for (const provider of __getProviders(surfaceId)) {
        const provided = provider();
        if (!provided) continue;

        const ref = provided.ref;
        if (ref) merged.ref = ref;
        if (provided.style) merged.style = { ...merged.style, ...provided.style };

        for (const [key, value] of Object.entries(provided)) {
            if (key.startsWith("data-") && typeof value === "string") {
                (merged as any)[key] = value;
            }
        }
    }

    return merged;
}
