# Bunsik: direct Next.js production launcher

## Scope

Railway project Bunsik / Urban-Eats serves this repository from `/apps/web`.
The source verified in production before this change was
`967a6ebccceb02c84cde596240f57682437e14dc`.

The sole runtime change invokes the same installed Next.js production CLI using
Node directly, avoiding a persistent npm parent. `npm start` remains available
unchanged for local workflows. The server continues to honor Railway `PORT=3001`.
No business source, package versions, lockfile, database, Wallet credentials,
notifications, assets, region, replica count, memory limits or pool settings change.
The deployment health gate uses the existing read-only `/admin/login` page.

This is deliberately not a standalone/export conversion: Wallet code resolves
assets relative to the application working directory. All 30 PNG assets, public
files, server route handlers and the existing output tracing configuration remain.

## Validation and limits

Run `node --test apps/web/test/runtime-launcher.test.cjs` from the repository root.
The full Next.js build must pass. The unchanged source has an existing tracing
warning from dynamic certificate paths in `apple-wallet.ts`.

The isolated integration comparison uses a newly initialized local PostgreSQL,
synthetic admin/client data and generated certificate/key material. Compare the
same build through npm and direct Node: page/status/redirect equivalence, a real
local bcrypt login/JWT, seven Apple Wallet stamp states with the three strip
resolutions, and Google Wallet JWT construction with a synthetic key. This is
not an Apple trust-chain acceptance test or a live Google Wallet update.

Production release checks must use read-only SQL counts and complete-row hashes
for all 15 public tables, plus schema fingerprint. Do not call registration,
sales, stamp, Wallet sync or setup endpoints in production. Verify existing pages,
anonymous authorization boundaries and Wallet lookup with a nonexistent ID.

Before the change, Railway reported mean RAM 166.36 MB over 24 hours with maximum
167.15 MB. Local process savings or cold-start RAM are not sustained bill savings.
Recheck after normal traffic and compare equal-duration windows.

The root pnpm lockfile is retained unchanged. Railway's existing isolated
`/apps/web` build uses npm and has no local npm lockfile; a rebuild can resolve
ranged transitive dependencies differently. Do not claim byte-identical images
or dependency trees. Validate the actual deployed build and runtime separately.

## Recovery

If any regression is detected, restore the previous successful deployment image
while it is retained by Railway, then revert this configuration change before a
future source build. No data or schema rollback is needed for this patch.
