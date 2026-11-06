/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@utils/css";
import { React } from "@webpack/common";

import { CL_PREFIX } from "../constants";

const cl = classNameFactory(CL_PREFIX);

interface IconProps {
    className?: string;
    size?: number;
}

export function PinIcon({ className, size = 14 }: IconProps) {
    return (
        <svg
            className={className}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
        >
            <path d="M14.5 2.5a1 1 0 0 1 1.7-.7l5 5a1 1 0 0 1-.5 1.7l-1.3.3a5 5 0 0 0-2.5 1.4l-1.2 1.2.6 4.1a1 1 0 0 1-1.7.9l-3.4-3.4-5.2 5.2a1 1 0 0 1-1.4-1.4l5.2-5.2-3.4-3.4a1 1 0 0 1 .9-1.7l4.1.6 1.2-1.2a5 5 0 0 0 1.4-2.5l.3-1.3Z" />
        </svg>
    );
}

export function CloseIcon({ className, size = 14 }: IconProps) {
    return (
        <svg
            className={className}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
        >
            <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4Z" />
        </svg>
    );
}

export { cl };
