---
"blume": patch
---

The theme toggle and the dismissible banner work where the browser blocks storage (Safari's "Block All Cookies", sandboxed iframes). Reading the saved theme threw before the page registered its navigation listeners, so the theme dropped on every client-router navigation; toggling the theme threw after switching off CSS transitions, leaving them off for the rest of the page; and dismissing the banner did nothing. Now the page changes first and the choice is saved when storage allows, and without storage a toggled theme or a dismissed banner still holds across navigations for the rest of the visit.
