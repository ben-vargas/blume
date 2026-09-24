---
"blume": major
---

`@asyncapi/converter` is now an optional peer dependency instead of a dependency. Blume only uses it to lift an AsyncAPI 1.x or 2.x spec to 3.0, and it pulled `@asyncapi/parser`, Spectral, and Scarf's telemetry postinstall into every install — a build script pnpm 12 refuses to run, so `pnpm dlx blume` failed before Blume started. AsyncAPI 3.x specs need nothing. If an `asyncapi()` reference points at a 1.x or 2.x spec, install the converter (`npm install @asyncapi/converter`); without it, `blume build` fails with that install command instead of rendering the reference.
