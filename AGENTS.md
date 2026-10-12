# Agent instructions

Before editing this plugin, read `skills/creating-plugins/SKILL.md` completely. Codex discovers the same directory through `.agents/skills`; Claude discovers it through `.claude/skills` and reads these instructions through `.claude/CLAUDE.md`.
Keep `emdash-plugin.jsonc` aligned with the runtime implementation, declare every capability and host the plugin uses, and run the generated validation, typecheck, test, and build scripts after changes.

## This repository

- Write code, docs, comments, errors and commit messages in English.
- Author and maintainer is Vibe Code (https://vcode.sh, hello@vcode.sh). User-facing docs speak in
  that voice: short, confident, a little dry. Every claim stays true and checkable.
- Read `skills/testing-patterns/SKILL.md` before writing, reviewing or deleting a test.
- Bun is the package manager. `bunfig.toml` selects the isolated linker so the
  plugin CLI's bundled TypeScript 6 builds declarations while `tsc` here is
  TypeScript 7. Do not switch back to the hoisted linker.
- Vitest stays on 4.x until `@emdash-cms/plugin-test` accepts Vitest 5; under
  Vitest 5 its Worker Loader host cannot read the Vitest cache and no test runs.
- Lint and format with Ultracite (`bun run check`, `bun run fix`). No Prettier
  or ESLint.
- The trust contract (`capabilities`, `allowedHosts`, `storage`) is consented
  to by every installed site. Widening it requires a major version.
- Gate before a release: `bun run check && bun run typecheck && bun run test && bun run build`.
