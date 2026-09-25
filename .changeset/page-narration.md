---
"blume": minor
---

Add narration: a "Listen to this page" player that reads each page aloud and highlights the sentence being read. Turn it on with `narration: true` to use the reader's browser voices, which need no key and work on any host. Or pass `narration: { provider: gateway({ model: "openai/tts-1-hd", voice: "alloy" }) }` to generate neural audio at build: one cached clip per sentence, shipped as static files, with browser voices as the fallback in `blume dev` or when the key is missing.

The player announces callouts, steps, tabs, and collapsible sections with short spoken cues, and skips code, tables, media, and type tables. It opens a closed section or switches to a hidden tab when narration reaches it, and keeps the sentence in view until the reader scrolls away. It offers speeds from 0.8× to 2×, and stops when the reader opens another page. Set `narration: false` in a page's frontmatter to leave it out, or add `data-blume-narration="skip"` to keep any element out of narration.
