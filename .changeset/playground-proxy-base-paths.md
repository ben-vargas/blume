---
"blume": patch
---

The API playground's built-in proxy (`playground: { proxy: true }`) now works under a `basePath` or a `deployment.base`: the endpoint mounts under `basePath` at `{basePath}/_api-proxy`, and the Send button targets it with the deployment base included.
