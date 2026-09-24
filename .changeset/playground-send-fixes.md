---
"blume": patch
---

The Try it panel no longer blocks Send on valid request bodies: it doesn't ask for `readOnly` properties the spec marks required, accepts `null` in nullable fields, and doesn't check one type of a field that allows several. The panel also works when the browser blocks storage (Safari's "Block All Cookies", sandboxed iframes), where it now simply doesn't remember credentials, and the AsyncAPI composer closes its WebSocket when a client-side navigation leaves the page. The request and response tabs move with the arrow keys, Home, and End, and the reference's spacing follows right-to-left layouts.
