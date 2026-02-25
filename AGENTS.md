# AGENTS.md

## Cursor Cloud specific instructions

### Project overview
CourtShare is a Next.js 16 (App Router) tennis court rental marketplace using TypeScript, Tailwind CSS v4, Firebase (Auth/Firestore/Storage), and Stripe for payments. See `README.md` for general context.

### Dev commands
All standard commands are in `package.json`:
- `npm run dev` — starts webpack dev server on port 3000
- `npm run build` — production build (uses Turbopack)
- `npm test` — Jest tests
- `npm run lint` — **broken**: `next lint` was removed in Next.js 16 and no standalone ESLint config exists

### Environment variables
A `.env.local` file is required. The app needs Firebase and Stripe credentials. With placeholder values the dev server starts and renders all pages (auth/payment flows will fail at runtime). See `src/lib/firebase.ts` and `src/lib/firebase-admin.ts` for required variables.

### Known issues (pre-existing)
- **Lint**: `npm run lint` fails because Next.js 16 removed the `next lint` subcommand and no `eslint.config.js` exists.
- **Tests**: Most Jest tests fail due to a path-mapping bug in `jest.config.js` — the `@/` alias maps to `<rootDir>/$1` but should map to `<rootDir>/src/$1` (the `tsconfig.json` maps `@/*` to `src/*`). The basic arithmetic test in `__tests__/sum.test.ts` passes.

### Project structure notes
- `app/` directory is at the repository root (not under `src/`).
- `src/` contains `components/`, `hooks/`, and `lib/` (shared code).
- All external services (Firebase, Stripe, Resend, Google Maps) are SaaS — no Docker or local infra needed.
