import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

import { join, relative } from "pathe";

import { analyzeComponentOverrides } from "../core/component-overrides.ts";
import { loadConfig } from "../core/config.ts";
import { BlumeError } from "../core/diagnostics.ts";
import { findComponentsFile } from "../core/project.ts";
import type { Diagnostic } from "../core/types.ts";

/**
 * `blume upgrade`'s logic, kept out of the command module so it runs (and is
 * covered) in-process: bump the `blume` dependency to the running CLI's major,
 * then check the project against it — the config through the same loader
 * every command uses, which names each removed or renamed field and its
 * replacement, and `components.ts` through the same static planner the build
 * runs. The command prints the findings or hands them to a coding agent.
 */

/** The upgrade guide's route on the Blume docs site. */
export const UPGRADE_GUIDE_URL = "https://useblume.dev/docs/upgrading";

/** The upgrade guide's file inside the published package's bundled docs. */
export const UPGRADE_GUIDE_FILE = join("docs", "03-upgrading.mdx");

/** What `bumpBlumeDependency` did to `package.json`. */
export type DependencyBump =
  | {
      field: DependencyField;
      from: string;
      status: "bumped";
      to: string;
    }
  | { range: string; status: "current" }
  | { status: "missing" };

type DependencyField = "dependencies" | "devDependencies";

const DEPENDENCY_FIELDS: DependencyField[] = [
  "dependencies",
  "devDependencies",
];

/** The slice of `package.json` the bump reads and rewrites. */
interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

// Leading comparators and a `v` may precede the major (`^1.7.3`, `>=1 <2`,
// `v1`); a protocol (`workspace:`, `file:`, `npm:`) or a tag (`latest`) names
// no major at all, and those ranges are left to the user.
const RANGE_MAJOR = /^[\s<=>^~v]*(?<major>\d+)/u;

/** The major version a dependency range pins, or null when it names none. */
export const rangeMajor = (range: string): number | null => {
  const major = RANGE_MAJOR.exec(range)?.groups?.major;
  return major === undefined ? null : Number(major);
};

// The file's own indentation (two spaces, four, or a tab), so the rewrite
// doesn't reformat a package.json the user keeps differently.
const INDENT = /^(?<indent>[ \t]+)"/mu;

/**
 * Point `package.json`'s `blume` dependency at `^version` when it pins an
 * older major. A range already on this major, or one that names no version
 * (`workspace:*`, `latest`), is reported as current and left alone; a
 * project with no `package.json`, or none that lists `blume`, is `missing`.
 */
export const bumpBlumeDependency = async (
  root: string,
  version: string
): Promise<DependencyBump> => {
  const path = join(root, "package.json");
  if (!existsSync(path)) {
    return { status: "missing" };
  }
  const text = await readFile(path, "utf-8");
  // SAFETY: package.json is a JSON object; only its dependency maps, which
  // map package names to range strings, are read.
  const pkg = JSON.parse(text) as PackageJson;
  const field = DEPENDENCY_FIELDS.find(
    (name) => pkg[name]?.blume !== undefined
  );
  const from = field ? pkg[field]?.blume : undefined;
  if (!(field && from)) {
    return { status: "missing" };
  }
  const current = rangeMajor(from);
  const target = rangeMajor(version);
  if (current === null || target === null || current >= target) {
    return { range: from, status: "current" };
  }
  const to = `^${version}`;
  const indent = INDENT.exec(text)?.groups?.indent ?? "  ";
  const updated = { ...pkg, [field]: { ...pkg[field], blume: to } };
  await writeFile(path, `${JSON.stringify(updated, null, indent)}\n`);
  return { field, from, status: "bumped", to };
};

/** Run one check, turning the {@link BlumeError} it throws into its finding. */
const findingOf = async (
  check: () => Promise<void>
): Promise<Diagnostic | null> => {
  try {
    await check();
    return null;
  } catch (error) {
    if (error instanceof BlumeError) {
      return error.diagnostic;
    }
    throw error;
  }
};

/**
 * Check a project against this version of Blume: its config through the
 * loader (one diagnostic that lists every invalid field with its replacement)
 * and its `components.ts` through the static override planner. Returns the
 * failures; an empty list means the project is ready.
 */
export const collectUpgradeFindings = async (
  root: string
): Promise<Diagnostic[]> => {
  const componentsFile = findComponentsFile(root);
  const findings = [
    await findingOf(async () => {
      await loadConfig(root);
    }),
    componentsFile
      ? await findingOf(async () => {
          analyzeComponentOverrides(
            await readFile(componentsFile, "utf-8"),
            componentsFile
          );
        })
      : null,
  ];
  return findings.filter((finding) => finding !== null);
};

/** A finding as plain text for the agent: where, what, and the fix. */
const plainFinding = (finding: Diagnostic, root: string): string => {
  const where = finding.file
    ? `${relative(root, finding.file)}${finding.line === undefined ? "" : `:${finding.line}`}`
    : "blume.config.ts";
  const fix = finding.suggestion ? `\n  Fix: ${finding.suggestion}` : "";
  return `- ${where} (${finding.code})\n  ${finding.message.replaceAll("\n", "\n  ")}${fix}`;
};

/**
 * The handoff prompt: the findings inline (they're few, and each already
 * names its replacement), where the guide is, and the ground rules — change
 * the config's shape, never the site's behavior, and verify with the site's
 * own checks.
 */
export const upgradePrompt = (options: {
  findings: Diagnostic[];
  guidePath: string;
  root: string;
  version: string;
}): string =>
  `Upgrade this Blume project to Blume ${options.version}. \`blume upgrade\` has bumped the \`blume\` dependency in package.json where it could; what's left is the config.

The upgrade guide is at ${options.guidePath} (online at ${UPGRADE_GUIDE_URL}). It covers every change between Blume 1 and 2 with before-and-after examples: search, deployment, content sources, API references, analytics, and Ask AI become adapters imported from \`blume/*\` subpaths; the machine-readable settings move from \`ai\` to \`agents\`; and \`components.ts\` entries must be one of the static forms.

\`blume upgrade\` found:

${options.findings.map((finding) => plainFinding(finding, options.root)).join("\n\n")}

Work through every finding:
1. Read the guide section for each change before editing.
2. Rewrite the config to the Blume 2 form, adding the adapter imports it needs. Keep the site's behavior the same: the same content, routes, search backend, deployment target, analytics, and credentials (keep reading secrets from the same environment variables).
3. The config loader reports every invalid field at once, but some changes only surface once earlier ones are fixed, so rerun \`blume doctor\` after each round of edits.
4. Never delete content, or remove a setting only to silence an error; if something needs a human decision, leave it and say so in your summary.

When \`blume doctor\` reports no errors, run \`blume build\` and fix anything it reports until it succeeds.`;
