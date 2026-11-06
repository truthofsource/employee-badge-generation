# Validation evidence

## Executed locally

| Check | Recorded result |
| --- | --- |
| Actual extracted TypeScript rules | 21 tests passed |
| Python reference/renderer | 16 tests passed |
| Executed demonstration | 6 checks passed |
| Terraform schema and mock plans | Validate passed; 2 mock tests passed; no apply |
| Browser | Desktop and 390-pixel mobile, tabs/rerun, origin/asset denials passed |
| Workflow syntax | actionlint 1.7.12 passed; no hosted workflow dispatched |
| Source secret scan | Trivy 0.75.0: zero findings in this prepared input |

The PDF page-size test establishes 243 x 153 points. The portrait shown is a fictional illustration, not an AI quality sample. Mocked image-edit tests establish request/response handling only. The extracted source tests cover actual direct issue, reprint/revocation and employee-owned read rules.

The [machine record](validation-results.json) includes date, commands, counts and source hashes. Screenshots come from the working local code. They are not hand-edited success states or Azure Portal captures.

## Reproduce

```bash
npm run test:source
python -B -m unittest discover -s tests -v
python -B -m lab demo
```

## Evidence boundaries

- Actual implementation source/tests are distinct from a compact public renderer or event adapter.
- Synthetic inputs preserve privacy; they do not establish real provider output quality, identity or employee findings.
- Mock plans do not prove deployed IAM, DNS, queue delivery, SQL adapter or application hosting.
- No Azure service start, actual employee operation, live provider request or paid image call occurred for this preparation.
- [Nonproduction screenshot capture](SCREENSHOT-PLAN.md) remains optional follow-up. Existing accepted operational history is not relabeled as a fresh cloud test.
