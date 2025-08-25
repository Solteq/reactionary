# Verification commands
- `npx nx affected:build` builds the projects affected by current changes.
- `npx nx affected:lint` lints and verifies the projects affected by current changes.

# Code style
- Use ES modules (import/export) syntax, not CommonJS (require).
- Keep things strongly typed. Do not use `as any` or similar unchecked type casts.

# Workflow
- Be sure to ensure that changes lint and build.
- Avoid introducing changes that would be breaking for any client consumer of the library without asking for clearance.