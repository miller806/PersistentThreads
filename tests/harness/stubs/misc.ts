/*
 * Harness stub: @utils/misc
 */

export function classes(...classNames: Array<string | null | undefined | false>) {
    return classNames.filter(Boolean).join(" ");
}
