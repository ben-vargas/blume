import { describe, expect, it } from "bun:test";

import {
  footerSocialLinks,
  SOCIAL_ICONS,
} from "../src/components/layout/footer-socials.ts";
import { FOOTER_SOCIALS } from "../src/core/footer.ts";
import { blumeConfigSchema } from "../src/core/schema.ts";

/**
 * The site footer (`footer` in blume.config.ts): social profile icons and up
 * to four link columns, validated by the schema and rendered by
 * `SiteFooter.astro` from the links `footerSocialLinks` resolves.
 */

/** A footer as written, valid or not. */
interface FooterInput {
  links?: { items: { href: string; label: string }[]; label?: string }[];
  socials?: Record<string, string>;
}

/** The config paths a footer fails validation at, with their messages. */
const footerIssues = (footer: FooterInput): string[] => {
  const result = blumeConfigSchema.safeParse({ footer });
  return result.success
    ? []
    : result.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`
      );
};

describe("the footer config", () => {
  it("takes socials and link columns, and leaves the footer off when unset", () => {
    const { footer } = blumeConfigSchema.parse({
      footer: {
        links: [
          { items: [{ href: "/docs", label: "Docs" }], label: "Product" },
          { items: [{ href: "https://acme.dev/blog", label: "Blog" }] },
        ],
        socials: { github: "https://github.com/acme", x: "https://x.com/acme" },
      },
    });
    expect(footer?.links).toHaveLength(2);
    expect(blumeConfigSchema.parse({ footer: {} }).footer).toEqual({
      links: [],
      socials: {},
    });
    expect(blumeConfigSchema.parse({}).footer).toBeUndefined();
  });

  it("rejects an unknown platform, a fifth column, and an empty one", () => {
    expect(footerIssues({ socials: { twitter: "https://x.com/a" } })).toEqual([
      'footer.socials: Unrecognized key: "twitter"',
    ]);
    const column = { items: [{ href: "/a", label: "A" }] };
    expect(
      footerIssues({ links: [column, column, column, column, column] })
    ).toEqual(["footer.links: footer.links holds at most 4 columns."]);
    expect(
      footerIssues({ links: [{ items: [], label: "Empty" }] })
    ).toHaveLength(1);
  });
});

describe(footerSocialLinks, () => {
  it("keeps the order written, each with its label and icon", () => {
    expect(
      // Built from entries: an object literal's keys would be sorted by the
      // formatter, and the order written is what's under test.
      footerSocialLinks(
        Object.fromEntries([
          ["x", "https://x.com/acme"],
          ["linkedin", "https://linkedin.com/company/acme"],
          ["github", "https://github.com/acme"],
        ])
      )
    ).toEqual([
      { href: "https://x.com/acme", label: "X", path: SOCIAL_ICONS.x.path },
      {
        href: "https://linkedin.com/company/acme",
        icon: "linkedin",
        label: "LinkedIn",
      },
      {
        href: "https://github.com/acme",
        label: "GitHub",
        path: SOCIAL_ICONS.github.path,
      },
    ]);
  });

  it("skips an empty URL", () => {
    expect(footerSocialLinks({ github: "" })).toEqual([]);
  });

  it("has an icon for every platform", () => {
    for (const platform of FOOTER_SOCIALS) {
      const icon = SOCIAL_ICONS[platform];
      expect(Boolean(icon.path ?? icon.icon)).toBe(true);
    }
  });
});
