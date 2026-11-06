/*
 * Install this plugin into a LOCAL, already-injected Equicord installation.
 *
 * What it does (and nothing else):
 *   1. refuses to run while Discord is open (unless --force-close)
 *   2. backs up %APPDATA%\Equicord\equicord.asar and settings\settings.json
 *   3. packs Equicord/dist/desktop into %APPDATA%\Equicord\equicord.asar
 *      (the injected Discord resources/app.asar is a 1-line loader that requires
 *       this asar, so it does not need to be touched)
 *   4. enables PersistentThreads + its SurfaceClassesAPI dependency in settings.json
 *
 * Usage:
 *   node scripts/install-to-local-equicord.mjs --dist ../Equicord/dist/desktop [--dry-run] [--force-close]
 *
 * Rollback: copy the backup files back over the originals while Discord is closed.
 */

import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const args = process.argv.slice(2);
const hasFlag = name => args.includes(`--${name}`);
const getOpt = (name, fallback) => {
    const index = args.indexOf(`--${name}`);
    return index === -1 ? fallback : args[index + 1];
};

const dryRun = hasFlag("dry-run");
const forceClose = hasFlag("force-close");

const scriptDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const distDir = path.resolve(getOpt("dist", path.join(scriptDir, "../../Equicord/dist/desktop")));
const dataDir = path.resolve(getOpt("data-dir", path.join(process.env.APPDATA ?? "", "Equicord")));

const asarTarget = path.join(dataDir, "equicord.asar");
const settingsFile = path.join(dataDir, "settings", "settings.json");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(dataDir, ".backups", stamp);

const PLUGINS_TO_ENABLE = ["PersistentThreads"];

function log(message) {
    console.log(`[install] ${message}`);
}

function fail(message) {
    console.error(`[install] ERROR: ${message}`);
    process.exit(1);
}

/* ------------------------------------------------------------- pre-flight */

for (const file of ["renderer.js", "patcher.js", "preload.js", "package.json"]) {
    if (!fs.existsSync(path.join(distDir, file))) {
        fail(`Build output missing ${file} in ${distDir}. Run "pnpm buildStandalone" first.`);
    }
}

if (!fs.existsSync(asarTarget)) {
    fail(`No injected Equicord found at ${asarTarget}. Install Equicord first (or pass --data-dir).`);
}

const renderer = fs.readFileSync(path.join(distDir, "renderer.js"), "utf8");
if (!renderer.includes('name:"PersistentThreads"')) {
    fail("The build in dist/desktop does not contain PersistentThreads. Put the plugin in src/userplugins and rebuild.");
}

const banner = renderer.split("\n").slice(0, 3).join(" | ");
log(`build:  ${banner}`);

/* ------------------------------------------------------------ discord app */

function discordProcesses() {
    try {
        // Use tasklist: works without PowerShell execution policy issues
        const out = execFileSync("tasklist", ["/FI", "IMAGENAME eq Discord.exe", "/NH"], { encoding: "utf8" });
        return out.split("\n").filter(line => line.toLowerCase().includes("discord.exe")).length;
    } catch {
        return 0;
    }
}

const running = discordProcesses();
if (running > 0) {
    if (!forceClose) {
        fail(`Discord is running (${running} process(es)). Quit Discord completely (tray -> Quit), then re-run this script.`);
    }

    log(`Closing ${running} Discord process(es)...`);
    execFileSync("taskkill", ["/IM", "Discord.exe", "/F"], { stdio: "inherit" });

    for (let i = 0; i < 40 && discordProcesses() > 0; i++) {
        execSync(process.platform === "win32" ? "timeout /t 1 >nul" : "sleep 1", { shell: true });
    }

    if (discordProcesses() > 0) fail("Discord did not exit.");
    log("Discord closed");
}

/* ---------------------------------------------------------------- backups */

if (dryRun) {
    log(`[dry-run] would back up to ${backupDir}`);
    log(`[dry-run] would pack ${distDir} -> ${asarTarget}`);
    log(`[dry-run] would enable ${PLUGINS_TO_ENABLE.join(", ")} in ${settingsFile}`);
    process.exit(0);
}

fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(asarTarget, path.join(backupDir, "equicord.asar"));

if (fs.existsSync(settingsFile)) {
    fs.copyFileSync(settingsFile, path.join(backupDir, "settings.json"));
}

log(`backup: ${backupDir}`);

/* ------------------------------------------------------- pack equicord.asar */

// @electron/asar lives in the Equicord checkout, not in this repo
const equicordRoot = path.resolve(distDir, "../..");
const requireFromEquicord = createRequire(path.join(equicordRoot, "package.json"));
const { createPackage, listPackage, extractFile } = requireFromEquicord("@electron/asar");

fs.rmSync(asarTarget, { force: true });
await createPackage(distDir, asarTarget);

const entries = listPackage(asarTarget).map(entry => entry.replaceAll("\\", "/"));
log(`packed ${entries.length} entries into equicord.asar`);

const packedRenderer = extractFile(asarTarget, "renderer.js").toString("utf8");
if (!packedRenderer.includes('name:"PersistentThreads"')) {
    fail("Post-pack verification failed: PersistentThreads is not in the packed renderer. Restoring backup.");
}

log("verified: PersistentThreads is present in the packed renderer");

/* ----------------------------------------------------------------- settings */

if (fs.existsSync(settingsFile)) {
    const raw = fs.readFileSync(settingsFile, "utf8");
    const hadTrailingNewline = raw.endsWith("\n");
    const settings = JSON.parse(raw);

    settings.plugins ??= {};
    for (const name of PLUGINS_TO_ENABLE) {
        settings.plugins[name] = { ...(settings.plugins[name] ?? {}), enabled: true };
    }

    const next = JSON.stringify(settings, null, 4) + (hadTrailingNewline ? "\n" : "");
    fs.writeFileSync(settingsFile, next, "utf8");
    log(`enabled in settings.json: ${PLUGINS_TO_ENABLE.join(", ")}`);
}

/* -------------------------------------------------------------------- done */

log("");
log("Installed. Start Discord, right click a thread and choose \"Pin to Channel\".");
log("Pinned threads stay visible under their parent channel, like a normal active thread.");
log("");
log("Rollback (with Discord closed):");
log(`  copy "${path.join(backupDir, "equicord.asar")}" "${asarTarget}"`);
if (fs.existsSync(settingsFile)) {
    log(`  copy "${path.join(backupDir, "settings.json")}" "${settingsFile}"`);
}
