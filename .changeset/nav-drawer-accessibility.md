---
"blume": patch
---

The mobile navigation drawer now behaves like the modal panel it is. Its toggle reports `aria-expanded` and names the drawer with `aria-controls`; Escape closes it; and while it is open the page behind it is `inert`, so Tab moves through the header and the drawer instead of into content the overlay covers. Closing it with focus inside, from Escape or the overlay's close button, returns focus to the toggle.
