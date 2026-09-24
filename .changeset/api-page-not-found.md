---
"blume": patch
---

On a server build, a request for the JSON of a page that doesn't exist (`/api/docs/pages/nope.json`) now gets the `PAGE_NOT_FOUND` problem naming the route, instead of the generic `API_ROUTE_NOT_FOUND` for an unknown endpoint. Per-page JSON is prerendered, so a miss fell through to the API catch-all, which now recognizes the path.
