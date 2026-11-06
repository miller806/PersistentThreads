/*
 * Harness stub: @utils/css
 */

type ClassNameArg = string | null | undefined | false | Record<string, boolean | null | undefined> | ClassNameArg[];

export const classNameFactory = (prefix: string = "") => (...args: ClassNameArg[]) => {
    const classNames = new Set<string>();

    const collect = (arg: ClassNameArg) => {
        if (!arg) return;
        if (typeof arg === "string") classNames.add(arg);
        else if (Array.isArray(arg)) arg.forEach(collect);
        else if (typeof arg === "object") {
            for (const [name, value] of Object.entries(arg)) if (value) classNames.add(name);
        }
    };

    args.forEach(collect);
    return Array.from(classNames, name => prefix + name).join(" ");
};
