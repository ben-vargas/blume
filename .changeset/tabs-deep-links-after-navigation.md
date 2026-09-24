---
"blume": patch
---

`<Tabs>` deep links (`?install=windows`, `#windows`) now open the linked tab when the reader arrives through a client-side navigation, not only on a full page load, and a tab no longer opens because the previous page's URL carried a matching hash. A `ts2js` fence inside a `<CodeGroup>` now becomes one of the group's tabs, labeled with the fence title, instead of showing its TypeScript and JavaScript pair under every tab.
