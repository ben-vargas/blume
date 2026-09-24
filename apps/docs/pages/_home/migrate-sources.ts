// The migration sources `blume migrate` handles: each brand's mark, name, and
// what the agent does for it. Shared by the homepage's Migrate picker and the
// /compare pages.

/**
 * The one-liner that migrates a site from `source`: the CLI names the source
 * and opens Codex on the `blume-migrate` skill bundled in the package
 * (`--claude` for Claude Code, shown beside the command).
 */
export const migrateCommand = (source: string): string =>
  `npx blume migrate ${source} --codex`;

// Brand marks, each a full <svg> so it can be injected via set:html (and copied
// into the trigger by the client script). Monochrome marks use currentColor so
// they track the theme; brand-colored marks stay fixed.
export const logos = {
  docusaurus:
    '<svg class="size-full" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><g fill="#3ECC5F"><path d="M23 163c-7.4 0-14-4-17.3-10A20 20 0 003 163c0 11 9 20 20 20h20v-20H23zm141 20h9v-4h-8z"/><path d="M183 53V43c0-11-9-20-20-20H73c-4-8-6-8-10 0-4-8-6-8-10 0-4-8-6-8-10 0-7-9-9-5-10.3 2.3-9-3-10.3-1.7-7.3 7.3-9 2-10 3-2.4 10.4-8 4-8 6 0 10-8 4-8 6 0 10-8 4-8 6 0 10-8 4-8 6 0 10-8 4-8 6 0 10-8 4-8 6 0 10-8 4-8 6 0 10-8 4-8 6 0 10-8 4-8 6 0 10-8 4-8 6 0 10-8 4-8 6 0 10 0 11 9 20 20 20h120c11 0 20-9 20-20"/></g><path fill="#FFF" d="M183 83l-70-4.3c-13.3-1.5-13.3-19.8 0-21.3l70-4.4"/><use href="#docusaurus-h" x="60"/><use href="#docusaurus-f" x="50"/><path d="M103 183h60c11 0 20-9 20-20V93h-60c-11 0-20 9-20 20v70z" fill="#FFFF50"/><g fill="none" stroke="#000" stroke-width="2" stroke-linecap="round"><path d="M63 53a1 1 0 10-20 0" stroke-width="5"/><path d="M183 62.6c-5 0-5 10-10 10.7-5 0-5-10-10-10s-5 9-10 9-5-8.5-10-8.5-5 8-10 8-5-7.25-10-7.25-5 6.5-10 6.5" stroke-linecap="butt"/><path d="M168 113h-50m50 10h-50m50 10h-50m50 10h-50m50 10h-50m50 10h-50"/></g><circle cx="143" cy="39.3" r="2.5"/><circle cx="163" cy="38" r="2.5"/><circle cx="113" cy="71" r="1"/><path d="M83 123h40v-20H83zm0 60h40v-40H83z" fill="#3ECC5F"/><g id="docusaurus-h" fill="#44D860"><circle cx="123" cy="113" r="10"/><circle cx="128" cy="104.3" r="2.4"/><circle cx="131.7" cy="108" r="2.4"/><circle cx="133" cy="113" r="2.4"/><circle cx="131.7" cy="118" r="2.4"/><circle cx="128" cy="121.7" r="2.4"/></g><g id="docusaurus-f" fill="#44D860"><circle cx="123" cy="163" r="20"/><circle cx="113" cy="145.7" r="5"/><circle cx="123" cy="143" r="5"/><circle cx="133" cy="145.7" r="5"/><circle cx="140.3" cy="153" r="5"/><circle cx="143" cy="163" r="5"/></g></svg>',
  fumadocs:
    '<svg class="size-full" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="blume-fuma" gradientTransform="rotate(45)"><stop offset="45%" stop-color="var(--blume-background)"/><stop offset="100%" stop-color="#dd7627"/></linearGradient></defs><circle cx="90" cy="90" r="87" fill="url(#blume-fuma)" stroke="#dd7627" stroke-width="6"/></svg>',
  mintlify:
    '<svg class="size-full" viewBox="-2.7 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill="#18E299" d="M18.4725 9.60528V3.91396C18.4725 3.30323 17.977 2.81641 17.3754 2.81641H11.6867C10.7931 2.81641 9.90842 2.99342 9.08564 3.32977C8.26285 3.67497 7.51085 4.17064 6.88271 4.80793L6.83847 4.85219C6.00684 5.69305 5.41408 6.73749 5.11328 7.88815C5.65296 7.74653 6.2103 7.67572 6.76767 7.66687C8.25399 7.64916 9.71378 8.12713 10.8993 9.02111C11.9698 9.81771 12.7837 10.9153 13.2261 12.181C13.6861 13.4644 13.7392 14.8629 13.3942 16.1817C14.5354 15.8808 15.5883 15.2878 16.4288 14.4558L16.473 14.4115C17.1011 13.7831 17.6054 13.0307 17.9504 12.2075C18.2955 11.3844 18.4636 10.4993 18.4636 9.60528H18.4725Z"/><path fill="#0C8C5E" d="M4.9434 9.50941C4.95221 7.76347 5.64849 6.08807 6.87361 4.83594L2.14058 9.57113C2.12296 9.58876 2.10532 9.59758 2.08769 9.61522C0.933084 10.7615 0.23681 12.2959 0.122231 13.9183C0.0164654 15.435 0.413078 16.934 1.2592 18.1862C1.33991 18.3056 1.5589 18.3449 1.68229 18.2303L4.58202 15.338C5.48985 14.4298 5.7719 13.0806 5.34002 11.8726C5.06679 11.1231 4.93459 10.3207 4.9434 9.50941Z"/><path fill="#0C8C5E" d="M16.4445 14.4121C15.5367 15.3027 14.3997 15.92 13.1658 16.1933C11.923 16.4667 10.6362 16.3873 9.43757 15.9641C9.43757 15.9641 9.42874 15.9641 9.41992 15.9641C8.21243 15.532 6.86394 15.8141 5.95612 16.7136L3.05634 19.6058C2.93295 19.7293 2.95057 19.9321 3.10041 20.0291C4.35197 20.8668 5.85035 21.2724 7.36632 21.1666C8.98806 21.052 10.5128 20.3553 11.6674 19.2002L11.7115 19.1561L16.4445 14.4209V14.4121Z"/></svg>',
  nextra:
    '<svg class="size-full" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M22.68 21.031c-4.98-4.98-4.98-13.083 0-18.063l.978-.978c.22-.22.342-.513.342-.825 0-.311-.122-.604-.342-.824-.44-.441-1.207-.44-1.648 0l-.979.978c-4.98 4.98-13.084 4.98-18.063 0L1.99.34a1.17 1.17 0 0 0-1.649 0 1.168 1.168 0 0 0 0 1.649l.978.978c4.98 4.98 4.98 13.083 0 18.063l-.977.978c-.221.22-.342.513-.342.825 0 .31.121.604.341.824.442.443 1.21.441 1.65 0l.977-.977c4.98-4.983 13.083-4.98 18.064 0l.978.977c.22.22.513.342.824.342.312 0 .605-.122.824-.342.22-.22.342-.512.342-.824 0-.313-.122-.605-.342-.825l-.977-.978z"/></svg>',
  starlight:
    '<svg class="size-full" viewBox="0 0 25 26" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="blume-starlight" x1="2.5" x2="21.61" y1="2.65" y2="25.4" gradientUnits="userSpaceOnUse"><stop stop-color="var(--starlight-gold-1, #FBD57F)"/><stop offset="1" stop-color="var(--starlight-gold-2, #D17F0D)"/></linearGradient></defs><path fill="url(#blume-starlight)" fill-rule="evenodd" d="M15.22 7.77 12.06.94 8.91 7.77l-.15.29L7 6.3a1.18 1.18 0 1 0-1.68 1.68l1.75 1.74-.2.1-.04.02L0 13l6.83 3.16.24.11-1.75 1.76A1.18 1.18 0 1 0 7 19.7l1.76-1.76.15.3 3.15 6.82 3.16-6.83.12-.24 1.71 1.71a1.18 1.18 0 1 0 1.68-1.67L17 16.3l.29-.15L24.13 13 17.3 9.84 17 9.7l1.73-1.73a1.18 1.18 0 1 0-1.68-1.67L15.35 8a4.15 4.15 0 0 1-.12-.21l-.01-.03Zm-3.17.36-.42.9a7.27 7.27 0 0 1-3.55 3.55l-.9.42.9.42a7.27 7.27 0 0 1 3.55 3.55l.42.9.42-.9a7.27 7.27 0 0 1 3.55-3.55l.9-.42-.9-.42a7.27 7.27 0 0 1-3.55-3.55l-.42-.9Z" clip-rule="evenodd"/><path fill="url(#blume-starlight)" d="M22.27 4.43a1.18 1.18 0 1 0-1.67-1.68l-.57.57a1.18 1.18 0 0 0 1.68 1.67l.56-.56ZM4.2 5.18c-.46.46-1.2.46-1.67 0l-.56-.56a1.18 1.18 0 0 1 1.67-1.68l.57.57c.46.46.46 1.2 0 1.67Zm0 15.64a1.18 1.18 0 0 0-1.67 0l-.56.56a1.18 1.18 0 0 0 1.67 1.68l.57-.57c.46-.46.46-1.2 0-1.67Zm18.07.75a1.18 1.18 0 0 1-1.67 1.68l-.57-.57a1.19 1.19 0 0 1 1.68-1.67l.56.56Z"/></svg>',
};

let svgInstance = 0;

/**
 * A mark's inline SVG with its ids (and every `#id` reference to them) made
 * unique to this render. The same mark can appear several times on one page —
 * the picker trigger and its option, a table header hidden on phones — and a
 * gradient referenced by a shared id resolves to the first copy, which draws
 * nothing when that copy is hidden. Call it wherever a mark is rendered.
 */
export const withUniqueIds = (svg: string): string => {
  svgInstance += 1;
  const suffix = `-${svgInstance}`;
  let out = svg;
  for (const match of svg.matchAll(/\sid="(?<id>[^"]+)"/gu)) {
    const id = match.groups?.id ?? "";
    out = out
      .replaceAll(`id="${id}"`, `id="${id}${suffix}"`)
      .replaceAll(`#${id}"`, `#${id}${suffix}"`)
      .replaceAll(`#${id})`, `#${id}${suffix})`);
  }
  return out;
};

export const sources = [
  {
    body: "The agent translates docs.json to blume.config.ts, reshapes config-driven navigation into folders and tabs, rewrites callouts to directives, inlines snippets, and maps Font Awesome icons to their Lucide equivalents.",
    id: "mintlify",
    logo: logos.mintlify,
    name: "Mintlify",
  },
  {
    body: "The agent moves your content/docs tree into place, turns every meta.json into a typed meta.ts, and rewrites Cards, Accordions, and Tabs to Blume's components — includes, frontmatter, and folder order intact.",
    id: "fumadocs",
    logo: logos.fumadocs,
    name: "Fumadocs",
  },
  {
    body: "The agent maps docusaurus.config and sidebars.js onto Blume, keeps your admonitions as directives, converts Tabs and _category_.json, and reports the swizzled-theme chrome it can't carry over.",
    id: "docusaurus",
    logo: logos.docusaurus,
    name: "Docusaurus",
  },
  {
    body: "The agent reads your starlight() config and src/content/docs collection, turns asides into directives, renames CardGrid, LinkCard, and TabItem, and maps the Starlight icon set to Lucide.",
    id: "starlight",
    logo: logos.starlight,
    name: "Starlight",
  },
  {
    body: "The agent brings your Nextra pages across as Blume MDX and turns every _meta file into a typed meta.ts — navigation order and frontmatter intact, callouts converted to directives.",
    id: "nextra",
    logo: logos.nextra,
    name: "Nextra",
  },
];

export type MigrateSource = (typeof sources)[number];

/** A migration source by id, for pages built around one tool. */
export const sourceById = (id: string): MigrateSource => {
  const source = sources.find((candidate) => candidate.id === id);
  if (!source) {
    throw new Error(`Unknown migration source: ${id}`);
  }
  return source;
};
