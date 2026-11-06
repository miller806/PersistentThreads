/*
 * Sync the PersistentThreads plugin sources out of the Equicord checkout into
 * this deliverable, then produce a ready-to-install ZIP.
 *
 * Usage (from the PersistentThreads repo root):
 *   node scripts/sync-from-equicord.mjs
 *   EQUICORD_ROOT=C:/path/to/Equicord node scripts/sync-from-equicord.mjs
 *
 * Layout produced:
 *   plugin/PersistentThreads/...   full sources incl. tests
 *   dist/PersistentThreads.zip     installable plugin (tests excluded)
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const equicordRoot = process.env.EQUICORD_ROOT
    ? path.resolve(process.env.EQUICORD_ROOT)
    : path.resolve(repoRoot, "../Equicord");

const pluginName = "PersistentThreads";
const sourceDir = path.join(equicordRoot, "src/userplugins", pluginName);
const targetDir = path.join(repoRoot, "plugin", pluginName);
const stagingDir = path.join(repoRoot, "dist", ".staging");
const stagedDir = path.join(stagingDir, pluginName);
const zipPath = path.join(repoRoot, "dist", `${pluginName}.zip`);

if (!fs.existsSync(path.join(sourceDir, "index.tsx"))) {
    console.error(`Plugin sources not found at ${sourceDir}`);
    console.error("Set EQUICORD_ROOT to your Equicord checkout.");
    process.exit(2);
}

function copyDir(from, to, { exclude = [] } = {}) {
    fs.mkdirSync(to, { recursive: true });

    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
        if (exclude.includes(entry.name)) continue;

        const fromPath = path.join(from, entry.name);
        const toPath = path.join(to, entry.name);

        if (entry.isDirectory()) copyDir(fromPath, toPath, { exclude });
        else fs.copyFileSync(fromPath, toPath);
    }
}

function rmrf(dir) {
    fs.rmSync(dir, { recursive: true, force: true });
}

// 1. Full copy for the deliverable repo (tests included)
rmrf(targetDir);
copyDir(sourceDir, targetDir);

// 2. Staging copy for the installable archive (tests excluded)
rmrf(stagingDir);
copyDir(sourceDir, stagedDir, { exclude: ["__tests__"] });

// 3. Zip it
rmrf(zipPath);

if (process.platform === "win32") {
    execFileSync("powershell", [
        "-NoProfile",
        "-Command",
        `Compress-Archive -Path '${stagedDir}' -DestinationPath '${zipPath}' -Force`,
    ], { stdio: "inherit" });
} else {
    execFileSync("zip", ["-r", "-q", zipPath, pluginName], { cwd: stagingDir, stdio: "inherit" });
}

rmrf(stagingDir);

const zipSize = fs.statSync(zipPath).size;
console.log(`Synced ${sourceDir}`);
console.log(`  -> ${path.relative(repoRoot, targetDir)} (sources incl. __tests__)`);
console.log(`  -> ${path.relative(repoRoot, zipPath)} (${(zipSize / 1024).toFixed(1)} KiB, installable)`);
