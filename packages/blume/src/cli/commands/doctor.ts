import { readFileSync } from "node:fs";

import { defineCommand } from "citty";
import { join } from "pathe";
import { satisfies } from "semver";

import { discoverIslands } from "../../astro/islands.ts";
import { missingDependencyDiagnostic } from "../../astro/runtime-deps.ts";
import { BlumeError } from "../../core/diagnostics.ts";
import { packageRoot } from "../../core/package-root.ts";
import { scanProject } from "../../core/project-graph.ts";
import { serverFeatures } from "../../core/server-features.ts";
import type { Diagnostic } from "../../core/types.ts";
import { commandMeta } from "../command-meta.ts";
import { loadEnvFiles } from "../env.ts";
import { reportInternalError } from "../internal-error.ts";
import {
  flushStdout,
  logger,
  reportDiagnostics,
  reportDiagnosticsJson,
} from "../log.ts";
import { checkRequiredSecrets } from "../required-secrets.ts";

const FALLBACK_NODE_RANGE = ">=22.12.0";

/** The supported Node range, read from the package's own `engines` field so
 * doctor can never drift from what the package actually declares. */
const supportedNodeRange = (): string => {
  try {
    // SAFETY: this parses blume's own package.json; the optional fields cover
    // an `engines` block going missing, and a bad read falls to the catch.
    const pkg = JSON.parse(
      readFileSync(join(packageRoot(), "package.json"), "utf-8")
    ) as { engines?: { node?: string } };
    return pkg.engines?.node || FALLBACK_NODE_RANGE;
  } catch {
    return FALLBACK_NODE_RANGE;
  }
};

export const doctorCommand = defineCommand({
  args: {
    json: {
      description: "Emit diagnostics as JSON on stdout (for CI/editors).",
      type: "boolean",
    },
  },
  meta: commandMeta.doctor,
  async run({ args }) {
    const root = process.cwd();
    const diagnostics: Diagnostic[] = [];

    const nodeRange = supportedNodeRange();
    if (!satisfies(process.versions.node, nodeRange)) {
      diagnostics.push({
        code: "BLUME_NODE_VERSION",
        message: `Node ${process.versions.node} is outside the supported range (${nodeRange}).`,
        severity: "warning",
      });
    }

    // Read `.env` files first, as `blume dev`/`build` do: remote sources read
    // their tokens during the scan, and the secrets check below reads them too.
    loadEnvFiles(root);

    try {
      const project = await scanProject(root, { mode: "build" });
      diagnostics.push(...project.diagnostics);

      const { config } = project;
      // The packages and secrets a build would need: an adapter's missing SDK
      // fails the build, and a missing secret fails at the first request.
      const { islands } = await discoverIslands(root);
      const dependencies = await missingDependencyDiagnostic(
        config,
        root,
        "error",
        islands.map((island) => island.framework)
      );
      if (dependencies) {
        diagnostics.push(dependencies);
      }
      diagnostics.push(...checkRequiredSecrets(config));
      const features = serverFeatures(config);
      if (
        features.length > 0 &&
        config.deployment.options.output === "static"
      ) {
        // A host adapter already names the target, so only its
        // `output: "static"` stands in the way; otherwise name one.
        const { kind } = config.deployment;
        diagnostics.push({
          code: "BLUME_SERVER_FEATURE_REQUIRED",
          message: `${features.join(", ")} ${features.length === 1 ? "requires" : "require"} server output.`,
          severity: "error",
          suggestion:
            kind === "static"
              ? 'Set deployment to a host adapter from "blume/deploy" (e.g. `deployment: vercel()`).'
              : `Drop \`output: "static"\` from \`deployment: ${kind}()\` to build for the server.`,
        });
      }

      if (!args.json) {
        logger.info(`Pages: ${project.graph.pages.length}`);
        logger.info(`Output: ${config.deployment.options.output}`);
        logger.info(`Adapter: ${config.deployment.kind}`);
        logger.info(`Search: ${config.search.provider.kind}`);
        logger.info(
          `References: ${config.reference.map((adapter) => adapter.kind).join(", ") || "none"}`
        );
        logger.info(
          `Analytics: ${config.analytics.map((adapter) => adapter.kind).join(", ") || "none"}`
        );
        logger.info(
          `Sources: ${config.content.sources.map((source) => source.kind).join(", ")}`
        );
        const { ask } = config.ai;
        let askSummary = "off";
        if (ask?.enabled) {
          askSummary = ask.endpoint ? "external endpoint" : ask.provider.kind;
        }
        logger.info(`Ask AI: ${askSummary}`);
      }
    } catch (error) {
      if (error instanceof BlumeError) {
        diagnostics.push(error.diagnostic);
      } else {
        reportInternalError(error);
        process.exit(1);
      }
    }

    if (args.json) {
      // Drain stdout before exiting non-zero: `process.exit` would otherwise
      // truncate the JSON payload mid-write when stdout is a pipe — exactly how
      // `--json` is consumed in CI/editors.
      if (reportDiagnosticsJson(diagnostics, root)) {
        await flushStdout();
        process.exit(1);
      }
      return;
    }

    const hadErrors = reportDiagnostics(diagnostics, root);
    if (diagnostics.length === 0) {
      logger.success("No problems found.");
    }
    if (hadErrors) {
      process.exit(1);
    }
  },
});
