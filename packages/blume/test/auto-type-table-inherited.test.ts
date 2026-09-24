import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { extractTypeTable } from "../src/components/content/auto-type-table.ts";

describe("AutoTypeTable inherited members", () => {
  let dir = "";

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "blume-auto-type-table-"));
    await writeFile(
      path.join(dir, "base.ts"),
      `export interface Base {
  /** The id. */
  id: string;
  label?: "a" | "b";
}
`
    );
    // Leading comments push Props' own positions past Base's, so slicing an
    // inherited member's range out of this file would read unrelated text.
    await writeFile(
      path.join(dir, "props.ts"),
      `import type { Base } from "./base";

// This comment only moves the declaration below further into the file, so
// the inherited members' offsets land on text that is not their type.
export interface Props extends Base {
  size: number;
}
`
    );
  });

  afterAll(async () => {
    await rm(dir, { force: true, recursive: true });
  });

  it("reads an imported base interface's types from the file that declares them", async () => {
    const rows = await extractTypeTable({
      name: "Props",
      path: "props.ts",
      root: dir,
    });

    const byName = Object.fromEntries(rows.map((row) => [row.name, row]));
    expect(byName.size?.type).toBe("number");
    expect(byName.id).toMatchObject({
      description: "The id.",
      required: true,
      type: "string",
    });
    expect(byName.label).toMatchObject({
      required: false,
      type: '"a" | "b"',
    });
  });
});
