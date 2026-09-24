---
"blume": major
---

Replace the `content.sources` `{ type: "…" }` objects with adapters imported from `blume/sources`: `filesystem()`, `mdxRemote()`, `githubReleases()`, `sanity()`, `notion()`, `obsidian()`, or `custom(source)` for any `ContentSource`. Every other field moves into the call unchanged, each factory that takes options also accepts `prefix` and `pollInterval`, and a leftover `type` object fails validation naming its factory:

```ts
import { filesystem, githubReleases } from "blume/sources";

export default defineConfig({
  content: {
    sources: [
      filesystem({ root: "content" }),
      githubReleases({ owner: "acme", repo: "sdk", prefix: "changelog" }),
    ],
  },
});
```

Each adapter declares the SDK and env vars it needs — `notion()` needs `@notionhq/client` and `NOTION_TOKEN`, `sanity()` needs `@sanity/client` and `SANITY_TOKEN`, and `githubReleases()` needs `GITHUB_TOKEN`, as does `mdxRemote()` when it reads from GitHub — so the generated project, the secrets check, and `blume doctor` take them from the adapter. The top-level `content.root`, `include`, and `exclude` remain the zero-config shorthand for one `filesystem()` source but can't sit beside `sources`: move them into the `filesystem()` entry.
