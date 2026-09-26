---
"blume": patch
---

Report search to your analytics. Once a query settles (a second without typing, or the reader picks a result or closes the dialog), the search dialog sends a `search` event with the `query`, its number of `results`, and the `path`, so queries with no results are easy to find. Picking a result sends `search_select` with the `query`, the result's `position`, and its `url`. Both go through every analytics adapter with an event API and as `blume:track` events.
