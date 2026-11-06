# Badge generation scaling and tradeoffs

**Terms used here:** An artifact is a file produced for a release, such as an application ZIP or container image.

| Choice | Strength | Weakness / tradeoff |
| --- | --- | --- |
| AI-assisted portrait preparation | Reduces repeated crop/cleanup work | Can alter appearance or fail on glare, blur and overlays; output quality needs explicit handling |
| Separate fixed renderer | Keeps name, title, logo and dimensions controlled by the application | Template/font revisions must be part of the prepared-release-file fingerprint |
| Saved immutable issued copies | Reprints are consistent and need no new image request | Retention, revocation and storage version references must be managed |
| Exact saved malware-scan results for the exact files | Keeps generated image/PDF handling inside the document security boundary | Adds asynchronous waiting and scan-result recovery work |
| Profile-sourced text | Reduces name/title drift and arbitrary overrides | Profile corrections require a new preparation/version |
| Private self-service endpoint | Employee can retrieve their own badge without seeing source IDs | Account-link ambiguity and revoked/old copies require careful denial behavior |

Use durable protection against repeating the same action and per-employee serialization. Reserve a paid-call admission slot before provider work, reconcile unknown outcomes and limit concurrency. Reprints should read stored bytes. Track preparation latency, rejection reason, provider spend, pending artifact age and issue/reprint/revoke events without logging source images or secrets.

At higher volume, separate image work from ordinary API requests and use bounded queues. Do not claim the standalone adapter provides distributed daily-budget enforcement: the deployed platform's policy/admission store is a separate part of the design. Review data transfer, model access, input quality and retention before live use.
