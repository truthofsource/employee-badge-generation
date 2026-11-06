# Employee badge infrastructure

The Terraform follows the actual badge container and exact-secret access boundaries. It uses an existing scan-protected storage account; it does not create another malware detector or weaken the account's network policy.

| File / resource | Purpose |
| --- | --- |
| `main.tf` private containers | Separate employee-badge headshots and generated artifacts |
| Application identity | Reference runtime identity, not a deployed API |
| Container contributor | Badge data access scoped to the two containers |
| Optional scanner reader | Blob Data Reader only on those two containers for the supplied scanner identity |
| Optional exact-secret reader | Key Vault Secrets User on one reviewed secret resource, never a vault-wide key value |
| Versioned URI / controls output | Proposed integration values; no secret value or application setting mutation |

```bash
terraform -chdir=infra init -backend=false -input=false
terraform -chdir=infra fmt -check -recursive
terraform -chdir=infra validate
terraform -chdir=infra test
```

The mock plans verify two private containers, default-Off optional grants and rejection of cleanup without a versioned credential binding. Inputs are placeholders. No apply, API start, new secret, image request or scheduled retention job is performed here.

## Integration

Supply the existing account from the malware-scanning infrastructure and the independently verified processor identity. The actual platform uses its existing business-API identity; this standalone reference creates an identity to make permissions reviewable. Attaching it to a runtime and deploying the application are separate steps.

The parent account still needs its actual network/DNS path, Defender result routing and correct host/data permissions. Badge source IDs, profile/issue history and retention require the application's database/schema. These are not created by a container resource. Do not store the OpenAI key in Terraform state: bind only the existing secret resource ID/version URI and resolve its value privately at runtime.

## Cost and cleanup

Containers/identities do not run image editing. Stored versions, scans, diagnostics and actual AI requests can be billed. AI cleanup is Off by default. Do not delete issued badges, original source records, audit history or shared storage as cleanup for unused drafts. A real destroy needs the correct isolated state and an ownership/retention review first.
