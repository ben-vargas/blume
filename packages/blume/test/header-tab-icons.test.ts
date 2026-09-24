import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";

/**
 * `navigation.tabs[].icon` is documented and accepted by the schema, so every
 * place a tab renders shows it: the header's tab bar (a link or a dropdown's
 * disclosure) and the rows of both navigation drawers. The `.astro` files
 * render only inside a built site, so these pin the markup.
 */
const source = async (path: string): Promise<string> => {
  const text = await readFile(
    new URL(`../src/components/layout/${path}`, import.meta.url),
    "utf-8"
  );
  // A Windows checkout may carry CRLF line endings.
  return text.replaceAll("\r\n", "\n");
};

/** A tab-icon render: the set icon (or image/SVG) through the shared Icon. */
const TAB_ICON =
  /\{tab\.icon && \(?\s*<Icon class="[^"]*shrink-0[^"]*" name=\{tab\.icon\} size=\{14\} \/>/gu;

describe("header tab icons", () => {
  it("renders a plain tab's icon in the header bar", async () => {
    const header = await source("Header.astro");
    expect(header.match(TAB_ICON)).toHaveLength(1);
    // The link lays the icon out beside its label.
    expect(header).toContain(
      'class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5'
    );
  });

  it("renders a dropdown tab's icon in the bar and the drawer", async () => {
    const menu = await source("NavTabMenu.astro");
    expect(menu.match(TAB_ICON)).toHaveLength(2);
  });

  it("renders a plain tab's icon in both navigation drawers", async () => {
    const layouts = await Promise.all(
      ["RootLayout.astro", "PageLayout.astro"].map(source)
    );
    for (const text of layouts) {
      expect(text).toContain('import Icon from "../Icon.astro";');
      expect(text.match(TAB_ICON)).toHaveLength(1);
      expect(text).toContain(
        '<span class="flex-1 truncate">{tab.label}</span>'
      );
    }
  });
});
