# PersistentThreads

Keeps selected Discord threads in the native thread list under their parent channel. No separate sidebar section, expiry notifications, or keep-alive messages.

## Usage

Enable PersistentThreads in Equicord. Right-click a thread and choose **Pin to Channel** (固定到频道). Use **Unpin from Channel** to remove the pin. Manage saved records in the plugin settings.

Pins are stored in Equicord settings without an expiry time. They only affect this client and do not prevent server-side archiving.

## Limitations

The plugin patches ActiveJoinedThreadsStore and merges locally saved pins into its result without mutating the original map. It uses Discord's native thread rows and ordering.

A thread must be available in ChannelStore to appear. Missing cached threads are skipped; the plugin does not fetch or unarchive them. Deleted or inaccessible threads cannot be restored by this plugin. Discord updates may invalidate the patch.

## Installation

Copy plugin/PersistentThreads into an Equicord checkout at src/userplugins/PersistentThreads, build the checkout, and install that build. dist/PersistentThreads.zip contains plugin sources, not a standalone executable.

## Validation

The native-list version passed 14 mocked integration tests and an Equicord standalone build. It was installed locally, but native UI testing was blocked by a Windows window-handle resource error. Restart, archived-thread, and cache-miss behavior still need real-client verification.

## Contribution status

Contribution proposal posted to the existing Discord request; awaiting maintainer feedback. No GitHub PR submitted yet. Author: miller (Discord ID: 854964314234814484). Upstream requires maintainer feedback on the request, human review, and disclosure of AI assistance. See docs/SUBMISSION-DRAFT.md. Older documents describe a superseded standalone sidebar implementation and are historical only.
