# Employee badge operations and troubleshooting

| Symptom | Likely boundary to inspect | Correct response |
| --- | --- | --- |
| ID portrait cannot be selected | Exact employee binding, current source, file readability and scan proof | Correct source selection or use an authorized headshot; do not cross-bind another record |
| AI preparation fails | Secret version/model binding, paid-request admission, provider response and source quality | Preserve safe request metadata; do not automatically repeat paid requests |
| Hair/appearance changed | Source-quality and before/after assessment | Keep the source, reject unsuitable output and use a clearer headshot where needed |
| Preview is stale | Current profile, draft revision, crop, template and artifact fingerprint | Prepare the current version; do not reuse an old issue fingerprint |
| Artifact is pending | Actual malware result, event queue and processor | Wait/investigate; a generated PDF is not automatically scan-cleared |
| Reprint changes design | Reprint should read saved issued artifacts | Do not re-render or call AI when requesting an existing issued version |
| Employee cannot open badge | Signed-in account link, latest version, revocation and exact clean artifact | Check ownership/read binding without exposing the original ID |
| Print size is wrong | PDF page box and printer scaling | Use actual size / 100%; the expected page is 243 x 153 points |

## Key custody and costs

The implemented platform resolves a versioned secret through Key Vault and a scoped identity. The public optional adapter accepts an environment binding for local integration; never put the API key in Git, a command argument, Terraform state or logs. The source platform's durable admission/concurrency controls are separate from this one-call adapter. Configure real limits before hosted use.

## Retention

Unused uploads/unissued drafts can be expired by the separately controlled retention process. Issued versions, revocations, audit and referenced key/source lineage need their own retention policy. Do not delete issued recovery material as if it were an unused draft.

## Local commands

```bash
npm run test:source
python -B -m unittest discover -s tests -v
python -B -m lab demo
```

See [commands](COMMANDS.md) for prerequisites and export. No Azure resource or paid model request is started by the local demo.
