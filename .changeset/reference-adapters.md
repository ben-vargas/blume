---
"blume": major
---

Replace the top-level `openapi`, `asyncapi`, and `graphql` config blocks with one `reference` list of adapters imported from `blume/reference`, rendered in order:

```ts
import { graphql, openapi, scalar } from "blume/reference";

export default defineConfig({
  reference: [
    openapi({ spec: "./openapi.yaml" }),
    graphql({
      spec: "./schema.graphql",
      endpoint: "https://api.example.com/graphql",
    }),
    scalar({ spec: "./legacy.yaml", route: "/legacy" }),
  ],
});
```

Each block's options move onto its factory unchanged, without `enabled` (leave an adapter out of the list to disable it), and the same kind can appear more than once with its own route. The Scalar embed is its own `scalar()` adapter instead of a `renderer` option: a 1.x `renderer: "scalar"` block becomes a separate `scalar({ spec, theme, … })` entry that forwards its other keys to the embed, while `openapi()` and `asyncapi()` always render Blume's own pages. The old keys and a leftover `renderer` fail validation with a hint naming the replacement.
