# Extracted badge implementation rules

These modules and their tests come from the implemented application. They cover source authorization, profile/portrait fingerprints, direct issuance, reprints, revocation and employee self-service.

```bash
npm run test:source
```

Node 22.18+ can run the explicit `.ts` imports using type stripping. No Node package installation, cloud credential or live database is required. `badgeErrors.ts` and `badgePorts.ts` expose the minimal error/type boundary; the production SQL/blob adapters are not included. See [the source map](../docs/SOURCE-MAP.md) for exact changes.
