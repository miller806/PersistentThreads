"""Extract real Discord renderer source snippets into a harness fixture.

Run: python3 tests/harness/fixtures/extract.py
Source: the local Discord client's Chromium cache (the chunk that contains the
channel list / ActiveJoinedThreadsStore code).
"""

import re
from pathlib import Path

CACHE = Path.home() / "AppData/Roaming/discord/Cache/Cache_Data/f_00006a"
OUT = Path(__file__).with_name("activeJoinedThreadsStore.ts")

src = CACHE.read_bytes().decode("utf8", "replace")

start = src.find('class q extends a.Ay.Store{static displayName="ActiveJoinedThreadsStore"')
end = src.find("let Z=new q(", start)
assert start > 0 and end > start, (start, end)
klass = src[start:end]

m = re.search(r"function eC\(e,t,n,i,r\)\{.{0,800}", src)
assert m, "channel thread list helper not found"
helper = m.group(0)


def esc(text: str) -> str:
    return text.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")


OUT.write_text(
    "/*\n"
    " * REAL Discord client source, extracted from the local Discord cache\n"
    " * (Chromium cache chunk of Discord app-1.0.9267).\n"
    " *\n"
    " * Provenance: minified `ActiveJoinedThreadsStore` class and the channel-row\n"
    " * thread-list helper from Discord's renderer bundle. The test suite uses this\n"
    " * to prove our patch regex matches real Discord code.\n"
    " *\n"
    " * DO NOT import this at runtime in the plugin.\n"
    " */\n\n"
    f"export const ACTIVE_JOINED_THREADS_STORE_CLASS = `{esc(klass)}`;\n\n"
    f"export const CHANNEL_THREAD_LIST_HELPER = `{esc(helper)}`;\n",
    encoding="utf8",
)

print(f"wrote {OUT} ({len(klass)} chars of class source)")
print(klass[:160])
