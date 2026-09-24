---
"blume": patch
---

The Ask AI route reads a request body only up to 64 KB and answers anything larger with a `413`, declared length or not. It used to parse the whole body before checking the conversation's size, so on a self-hosted Node server one oversized request could take hundreds of megabytes of memory. The Mixedbread search endpoint reads its body under a 16 KB cap the same way.
