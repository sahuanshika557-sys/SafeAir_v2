# Contributing to SafeAir Saathi

Thank you for helping improve SafeAir Saathi! This project prioritizes reliability, clean bilingual UX (English & Hindi), strict TypeScript safety, zero runtime secret exposure, and WCAG 2.2 AA accessibility.

## Development Setup

### Prerequisites

- **Node.js `>= 22.12.0`**
- **Bun** (`bun.lock` is committed and used by Vercel/CI) or `npm`
- Optional Google Gemini API key for live AI testing

### Install & Run

```bash
bun install --frozen-lockfile
cp .env.example .env
npm run dev
```

Visit `http://localhost:3000`. Open-Meteo AQI queries and rule-based plans work even without `GEMINI_API_KEY` configured.

## Project Scripts

| Command                 | Purpose                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `npm run dev`           | Starts local Express + Vite dev server on port `3000`                                                   |
| `npm run build`         | Builds frontend (`dist/`) and Node production server (`dist-server/`)                                   |
| `npm start`             | Runs production Express server (`node dist-server/server.js --prod`)                                    |
| `npm run lint`          | Runs strict ESLint checks across `src/`, `api/`, `tests/`, and `server.ts`                              |
| `npm run lint:fix`      | Auto-fixes ESLint issues                                                                                |
| `npm run typecheck`     | Runs `tsc --noEmit` with strict TypeScript flags (`noUncheckedIndexedAccess`, etc.)                     |
| `npm run format:check`  | Checks Prettier formatting                                                                              |
| `npm test`              | Runs all Vitest suites                                                                                  |
| `npm run test:coverage` | Runs Vitest with enforced V8 coverage thresholds (`>=94%` lines/stmts, `>=95%` funcs, `>=90%` branches) |
| `npm run check`         | Runs `format:check`, `lint`, `typecheck`, `test`, and `build`                                           |

## Code Style & Standards

- **Strict TypeScript:** Avoid `any`, type assertions (`as`), and non-null assertions (`!`). Prefer Zod schemas and type guards for runtime boundaries.
- **Modular Files:** Keep source files cohesive and concise (`<= 210` code lines), functions focused (`<= 45` lines for logic), and constants defined in `src/constants/` with JSDoc comments.
- **Bilingual Parity:** Any UI key added to `src/i18n/en.ts` must have an idiomatic Devanagari Hindi translation in `src/i18n/hi.ts` (automatically verified by tests).
- **Accessibility:** Interactive states, forms, tabs, and themes (light + dark) must pass `jest-axe` with zero violations and preserve `>= 44px` touch targets and keyboard navigation.
- **No Raw HTML:** Never use `dangerouslySetInnerHTML`; extend `SafeMarkdown` AST parsing if new formatting primitives are ever needed.

## Pull Request & Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat: ...` for new features
- `fix: ...` for bug fixes
- `refactor: ...` for behavior-preserving internal improvements
- `docs: ...` for documentation updates
- `test: ...` for test additions/coverage improvements
- `chore: ...` for build, CI, or dependency maintenance

Before opening a PR, verify:

```bash
npm run check
npm run test:coverage
```
