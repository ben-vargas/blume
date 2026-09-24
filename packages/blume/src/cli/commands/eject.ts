import { defineCommand } from "citty";
import { relative } from "pathe";

import { eject } from "../../registry/eject.ts";
import { commandMeta } from "../command-meta.ts";
import { refuseIfDevRunning } from "../dev-lock.ts";
import { updatePackageScripts } from "../eject-scripts.ts";
import { commandsFor, detectProjectPackageManager } from "../init/scaffold.ts";
import { logger } from "../log.ts";

export const ejectCommand = defineCommand({
  args: {
    yes: { description: "Skip the confirmation prompt.", type: "boolean" },
  },
  meta: commandMeta.eject,
  async run({ args }) {
    const root = process.cwd();
    refuseIfDevRunning(root, "ejecting");

    if (!args.yes) {
      logger.warn(
        "Eject is one-way: it writes astro.config.mjs, src/, and (if absent) tsconfig.json, rewrites your package.json scripts, adds the packages the Astro app imports to its dependencies, and removes .blume. An existing tsconfig.json is left untouched."
      );
      logger.info("Re-run with --yes to proceed.");
      return;
    }

    const { dependencies, files, warnings } = await eject(root);
    const added = await updatePackageScripts(root, dependencies);

    // The same surface as the generated-runtime path (prepare.ts): one warn
    // per generation warning, e.g. a Scalar reference spec that wasn't found.
    for (const warning of warnings) {
      logger.warn(warning);
    }

    logger.success(`Ejected ${files.length} file(s):`);
    for (const file of files) {
      process.stdout.write(`  ${relative(root, file)}\n`);
    }
    // Print run commands matching the project's package manager (lockfile
    // detection, since eject runs inside an existing project).
    const pm = await detectProjectPackageManager(root);
    const { build, dev, install } = commandsFor(pm);
    // Newly added dependencies aren't installed yet, so install comes first.
    const run = added.length > 0 ? [install, dev, build] : [dev, build];
    const addedNote =
      added.length > 0 ? `Added to package.json: ${added.join(", ")}.\n\n` : "";
    logger.box(
      `Your project is now a standalone Astro app.\n\n${addedNote}${run.map((command) => `  ${command}`).join("\n")}\n\nThe blume package remains importable.`
    );
  },
});
