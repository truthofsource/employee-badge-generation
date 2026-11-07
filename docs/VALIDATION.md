# Validation evidence

**Terms used here:** DNS turns a service name into the network address used to reach it.

## Executed locally

| Check | Recorded result |
| --- | --- |
| Actual extracted TypeScript rules | 21 tests passed |
| Python reference/renderer | 16 tests passed |
| Executed demonstration | 6 checks passed |
| Terraform schema and mock plans | Validate passed; 2 tests using simulated cloud responses passed; no apply |
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

## Troubleshooting documentation review — November 7, 2026

Added a README incident summary and a linked historical lessons guide, checking the account against the maintained source records. Documentation checks covered local links, complete incident fields, identifying-information patterns, whitespace and preservation of the existing four-step walkthrough. Shared incidents link to the relevant project details; unresolved causes remain explicit.

This was an editorial update. Application code, tests, Terraform, images, workflow definitions and cloud settings were not changed. Existing functional test counts and screenshots above retain their original scope and dates; no application suite, live scan, paid image request, recovery rehearsal or GitHub Actions run was executed for this documentation pass.
