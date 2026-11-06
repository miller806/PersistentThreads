/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/** Bump when the persisted shape changes and add a migration in pure.ts */
export const STATE_VERSION = 1;

/** Settings key that stores the whole versioned state object */
export const STATE_KEY = "pinnedThreads";

/** CSS class prefix used by this plugin */
export const CL_PREFIX = "vc-persistent-threads-";
