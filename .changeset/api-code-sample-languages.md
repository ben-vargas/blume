---
"blume": minor
---

API references can generate code samples in 18 languages: cURL, Python, JavaScript, Node.js, TypeScript, PHP, Go, Java, Ruby, PowerShell, Swift, C#, .NET, C, C++, Kotlin, Rust, and Dart. List them in `codeSamples` on `openapi()` or `graphql()` in the order you want them, by id or by a common alias such as `golang`, `c#`, or `ts`. Each sample quotes values by its own language's string rules and updates live with the Try it form. `node` and `typescript` now generate their own samples (axios, and typed `fetch`) instead of repeating the JavaScript one.

Operations also render the spec's own `x-codeSamples` (or `x-code-samples`) as tabs ahead of the generated samples, for SDK snippets written by hand or by Speakeasy or Stainless. Set `codeSamples: false` to show only those.
