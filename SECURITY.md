# Employee badge generation: security and privacy

This public case study uses actual implementation rules plus fictional local inputs. The loopback workbench is not an internet-facing application.

- Identity, owner, immutable version and current state are separate checks.
- The application must resolve trusted records; browser JSON is not a trusted ownership or scan verdict.
- The dashboard binds to `127.0.0.1`, checks Host/Origin and uses an asset allowlist and restrictive CSP.
- Cloud credentials, provider keys, original IDs, employee records, Terraform state/plans and private operational exports stay outside Git.
- Manual CI has repository read permission only and no OIDC/cloud deployment permission.
- A local source test is not live cloud permission, provider-quality or security certification evidence.

Report defects with fictional reproduction data. Do not attach real identity documents, employee images, bearer tokens, secret values or live secure links.
