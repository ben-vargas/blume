---
"blume": patch
---

A header tab with `items` renders as a dropdown: its items open in a menu from the header, and expand in place under the tab in the mobile navigation drawer. The tab's `path` still scopes the sidebar and marks it as current. Before, `navigation.tabs[].items` was accepted but every tab rendered as a plain link.
