# Actual implementation and public reference map

| Public code | Origin / purpose |
| --- | --- |
| `reference/badgeWorkflow.ts` and its test | Actual source resolution, profile name, crop and preparation-fingerprint rules |
| `reference/badgePortraitGeometry.ts` | Actual validated geometry metadata used by source fingerprints |
| `reference/badgeIssuance.ts` and its test | Actual repeat-safe review/direct issue/reprint/revoke logic through repository ports |
| `reference/badgeSelfService.ts` and its test | Actual employee-owned current badge and exact artifact release rules |
| `reference/badgeErrors.ts` / `badgePorts.ts` | Small public error/type boundary replacing private SQL/blob adapter imports |
| `lab/render.py` | Portable fixed-template renderer at the same physical badge size, with fictional artwork/input |
| `lab/portrait_ai.py` | Small optional image-edit integration matching the portrait-only boundary; not the entire hosted AI assessment system |
| `infra/` | Related private-container, scoped scanner-reader and exact-secret access patterns |

The extracted TypeScript imports use explicit `.ts` paths so Node can run them without a package install. Access-role prefixes are neutral and fixture UUIDs are fictional. Domain behavior is retained; the hosted SQL/Blob adapters, production artwork, actual keys and private employee images are not copied.

Source tests include both optional manual review and the current direct-issuance path. The project does not introduce a mandatory human approval step. Exact ownership/current-state/artifact checks still apply.
