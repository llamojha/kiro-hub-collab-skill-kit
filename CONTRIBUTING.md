# Contributing

Thank you for contributing to Kiro Collab Skill Kit.

## Before you start

- Open an issue before proposing a large feature or architecture change.
- Keep the MVP standalone: direct Amazon Bedrock generation, AgentCore Harness testing, local first-party or user-provided inspiration, and no Registry, marketplace, publishing, authentication, remote discovery, or multi-human realtime features.
- Do not add copied external skills, prompts, or fixtures. Follow the provenance requirements in [NOTICE.md](NOTICE.md).
- Never commit credentials, account identifiers, private endpoints, generated cloud output, customer data, or local `.env` files.
- Keep dependency versions exact. Dependency additions or upgrades need a separate, explicit review.

## Local setup

Use Node.js 22 or later. From the project root:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Leave both `VITE_*_API_URL` values blank for deterministic mock mode. Do not deploy a sandbox or invoke live Bedrock or Harness services as part of a routine contribution.

## Required checks

Run the narrowest relevant tests while developing, then run:

```bash
npm run typecheck
npm test
npm run build
npm run verify:standalone
```

If a change affects package contents, also run `npm pack --dry-run`. Live integration evidence is separate from the required local checks and must not contain prompts, credentials, raw Harness output, or private identifiers.

## Pull requests

Keep pull requests focused and describe:

1. The concrete problem and why the change is in MVP scope.
2. Files and behavior changed.
3. Commands run and observed results.
4. Any behavior that still requires an explicitly approved sandbox or live-service check.
5. Provenance for every new bundled example or content asset.

By contributing, you agree that your contribution is licensed under the repository's [MIT License](LICENSE).
