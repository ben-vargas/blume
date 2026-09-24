---
"blume": minor
---

New `blume migrate [source]` command for moving a docs site from another framework to Blume. Run it in the site being migrated (`npx blume migrate fumadocs --claude`): it names the source — `mintlify`, `fumadocs`, `docusaurus`, `starlight`, or `nextra`, detected from the project's files when left out — then opens Claude Code (`--claude`) or Codex (`--codex`) on the `blume-migrate` skill bundled in the package, with that framework's mapping reference. Without an agent flag it prints the skill's path for any other agent. The new [Migrate to Blume](https://useblume.dev/docs/migrating) guide covers what the agent changes.
