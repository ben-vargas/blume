---
"blume": patch
---

The browser's Back button works again after opening a tab or an accordion. Clicking a `<Tabs>` tab, or opening an `<AccordionItem>` or `<Expandable>` (including one opened from a `#hash` link on load), replaced the page's history entry with an empty state, which Astro's client router ignores — so going Back to that page changed the URL but left the next page on screen. The URL is still updated to the open tab or item, now keeping the router's state.
