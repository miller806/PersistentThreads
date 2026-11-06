# PersistentThreads headless UI harness

Bundles the **real plugin sources** from an Equicord checkout with esbuild, replaces
Discord / Vencord modules with contract-faithful stubs (`stubs/`), and drives the plugin
inside jsdom exactly like Equicord does (`plugin.start()` + handing the surface `ref`
the DOM node).

```bash
npm install
EQUICORD_ROOT=/path/to/Equicord node run.mjs
```

What it verifies:

- the sidebar section is mounted into the surface element and renders the expected DOM
- context menu entries exist only for thread channels (10/11/12) and toggle pin/unpin
- pinning persists the documented `{ version, items[] }` schema, dedupes, and supports many entries
- clicking a row calls `ChannelRouter.transitionToThread`, with the documented fallback chain
- guild isolation, live renames, deleted threads (`Unavailable`), not-yet-loaded guilds (`Loading…`)
- keyboard reordering + drag & drop reordering persist `sortOrder`
- disable/enable cleanup (no leftover DOM, providers, timers or React roots) and corrupted-data repair
- no React warnings/console errors during a full lifecycle

It does **not** verify how the real Discord client renders or how its DOM is structured.
