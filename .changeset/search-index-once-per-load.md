---
"blume": patch
---

Search loads its client and index once per visit instead of once per page. Each client-router navigation rebuilds the header, and the first search after it fetched `blume-search.json` again and rebuilt the index — on a large site, a megabyte-plus download and a visible pause before results on every page. A failed load still retries on the next open.
