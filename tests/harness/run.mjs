/*
 * PersistentThreads headless UI harness runner.
 *
 * - sets up jsdom + a React "act" environment
 * - bundles the real plugin sources from the Equicord checkout, swapping Discord
 *   and Vencord modules for the stubs in ./stubs
 * - executes ./entry.tsx which drives the plugin exactly like Equicord would
 *
 * This does NOT replace testing inside the Discord client.
 */

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as esbuild from "esbuild";
import { JSDOM } from "jsdom";

const here = path.dirname(fileURLToPath(import.meta.url));
const equicordRoot = process.env.EQUICORD_ROOT
    ? path.resolve(process.env.EQUICORD_ROOT)
    : path.resolve(here, "../../../Equicord");

if (!fs.existsSync(path.join(equicordRoot, "src/userplugins/PersistentThreads/index.tsx"))) {
    console.error(`Could not find the PersistentThreads sources in "${equicordRoot}".`);
    console.error("Set EQUICORD_ROOT to your Equicord checkout (the plugin must live in src/userplugins/PersistentThreads).");
    process.exit(2);
}

/* ------------------------------------------------------------------ jsdom */

const dom = new JSDOM("<!doctype html><html><body><div id=\"app\"></div></body></html>", {
    url: "https://discord.com/channels/@me",
    pretendToBeVisual: true,
});

const { window } = dom;

for (const key of [
    "window", "document", "navigator", "location", "history",
    "HTMLElement", "HTMLDivElement", "HTMLButtonElement", "Element", "Node", "NodeList",
    "Event", "CustomEvent", "MouseEvent", "KeyboardEvent", "DragEvent", "FocusEvent",
    "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "MutationObserver",
]) {
    const value = key === "window" ? window : window[key];
    if (value === undefined) continue;

    try {
        Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    } catch {
        // Some Node globals are read only, ignore
    }
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const require = createRequire(import.meta.url);
const React = require("react");

// The Equicord JSX factory resolves React lazily off the Vencord global
globalThis.Vencord = { Webpack: { Common: { React } } };

/* ------------------------------------------------------------------ build */

const outDir = path.join(here, "build");
fs.mkdirSync(outDir, { recursive: true });

const aliases = {
    "@utils/Logger": path.join(here, "stubs/Logger.ts"),
    "@utils/types": path.join(here, "stubs/types.ts"),
    "@utils/css": path.join(here, "stubs/css.ts"),
    "@utils/misc": path.join(here, "stubs/misc.ts"),
    "@api/Settings": path.join(here, "stubs/Settings.ts"),
    "@api/SurfaceClasses": path.join(here, "stubs/SurfaceClasses.ts"),
    "@components/ErrorBoundary": path.join(here, "stubs/ErrorBoundary.tsx"),
    "@webpack/common": path.join(here, "stubs/webpack-common.tsx"),
    "@vencord/discord-types": path.join(here, "stubs/discord-types.ts"),
    "@vencord/discord-types/enums": path.join(equicordRoot, "packages/discord-types/enums/index.ts"),
    "#plugin": path.join(equicordRoot, "src/userplugins/PersistentThreads/index.tsx"),
};

const aliasPlugin = {
    name: "harness-alias",
    setup(build) {
        build.onResolve({ filter: /^(?:@(?:utils|api|components|webpack|vencord)\/|#plugin$)/ }, args => {
            const target = aliases[args.path];
            if (!target) return undefined;
            return { path: target };
        });
    },
};

const managedCssPlugin = {
    name: "harness-managed-css",
    setup(build) {
        build.onResolve({ filter: /\.css\?managed$/ }, args => ({
            path: args.path,
            namespace: "managed-css",
        }));
        build.onLoad({ filter: /.*/, namespace: "managed-css" }, args => ({
            contents: `export default ${JSON.stringify(args.path)};`,
            loader: "js",
        }));
    },
};

const outfile = path.join(outDir, "harness.cjs");

await esbuild.build({
    entryPoints: [path.join(here, "entry.tsx")],
    outfile,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    jsx: "transform",
    jsxFactory: "VencordCreateElement",
    jsxFragment: "VencordFragment",
    inject: [path.join(equicordRoot, "scripts/build/inject/react.mjs")],
    external: ["react", "react-dom", "react-dom/client"],
    logLevel: "warning",
    plugins: [aliasPlugin, managedCssPlugin],
    define: {
        "process.env.NODE_ENV": JSON.stringify("test"),
    },
});

/* -------------------------------------------------------------------- run */

const harnessModule = require(outfile);

try {
    const result = await harnessModule.run();
    process.exit(result.failed === 0 ? 0 : 1);
} catch (error) {
    console.error("Harness crashed:", error);
    process.exit(1);
}
