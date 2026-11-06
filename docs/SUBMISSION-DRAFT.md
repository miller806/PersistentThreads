# Submission — posted to existing request

Suggested title: PersistentThreads: keep selected threads under their parent channel

I would like to contribute a plugin that keeps selected threads in their original parent-channel list after they become inactive. Pin and unpin actions are local; the plugin sends no keep-alive messages and does not change server-side archival state.

The prototype patches ActiveJoinedThreadsStore and merges saved thread IDs into its result using channels already loaded by Discord. Missing cached threads are currently skipped. A standalone build and 14 mocked integration tests pass; real-client behavior is not yet fully verified.

Would this feature be suitable for inclusion, and is there an existing request or implementation I should follow?

AI disclosure: OpenAI Codex assisted with implementation, code inspection, documentation, and simulated testing. The contributor confirmed review of the submission text.

## Before submission

- Human contributor reviews and edits this text and understands the implementation.
- Author supplied: miller (Discord ID: 854964314234814484).
- Check the Discord plugin request tracker for duplicates and obtain maintainer feedback.
- Verify pin/unpin, restart, archive and missing-cache cases in a real Discord client.
- Run upstream lint/type checks on the final submission branch.
- Confirm the target branch with maintainers: website documentation and the checked-out CONTRIBUTING.md disagree.


## Submitted

2026-11-06: Posted as miller to the existing Custom thread hide duration request (no duplicate post).

https://discord.com/channels/1173279886065029291/1439682155134451812/1568146059450908672

Awaiting maintainer feedback; no GitHub PR submitted yet.
