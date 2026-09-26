import { defineConfig } from "blume";
import { script } from "blume/analytics";
import { native } from "blume/consent";
import { node } from "blume/deploy";
import { memory } from "blume/ratelimit";
import { asyncapi, graphql, openapi } from "blume/reference";
import { filesystem, githubReleases } from "blume/sources";
import { z } from "zod";

/**
 * Kitchen-sink sandbox: every Blume feature enabled in one project, for
 * exercising the framework end to end — including the native OpenAPI and
 * AsyncAPI renderers, search, the assistant, MCP, i18n, export, OG images,
 * narration, content variables, pattern redirects, the site footer, written
 * feedback, rate limiting, and cookie consent (the `script()` analytics logs to the console,
 * with every tracked event, only once a reader accepts).
 */
export default defineConfig({
  agents: {
    mcp: { enabled: true },
    skills: "../../skills",
  },
  ai: {
    assistant: {
      enabled: true,
      suggestions: [
        { icon: "rocket", label: "How do I get started?" },
        { icon: "radio", label: "What events does the API publish?" },
        { icon: "blocks", label: "Which components can I use?" },
      ],
    },
  },
  analytics: [
    script({
      content:
        'console.info("[sandbox] analytics ran after consent");addEventListener("blume:track",(e)=>console.info("[sandbox] track",e.detail));',
    }),
  ],
  api: {
    auth: { method: "bearer" },
    playground: { proxy: true },
    server: "https://api.acme.dev/v1",
  },
  banner: {
    content: "This is the Blume kitchen-sink sandbox.",
    dismissible: true,
    id: "sandbox",
    link: { href: "/events", text: "Try the AsyncAPI reference" },
  },
  consent: native({ policy: "/docs/privacy" }),
  content: {
    sources: [
      filesystem({ root: "content" }),
      githubReleases({
        owner: "haydenbleasel",
        prefix: "changelog",
        repo: "blume",
      }),
    ],
    types: {
      doc: { facets: ["owner"] },
    },
  },
  deployment: node({ site: "https://sandbox.useblume.dev" }),
  description: "Every Blume feature, enabled in one place.",
  export: true,
  feedback: { comments: true },
  footer: {
    links: [
      {
        items: [
          { href: "/docs", label: "Getting started" },
          { href: "/docs/components", label: "Components" },
          { href: "/changelog", label: "Changelog" },
        ],
        label: "Docs",
      },
      {
        items: [
          { href: "/api", label: "REST API" },
          { href: "/graphql", label: "GraphQL" },
          { href: "/events", label: "Events" },
        ],
        label: "References",
      },
      {
        items: [
          { href: "https://github.com/haydenbleasel/blume", label: "GitHub" },
          { href: "https://useblume.dev", label: "useblume.dev" },
        ],
        label: "Project",
      },
    ],
    socials: {
      github: "https://github.com/haydenbleasel/blume",
      website: "https://useblume.dev",
      x: "https://x.com/haydenbleasel",
    },
  },
  frontmatter: {
    extend: {
      owner: z.string().optional(),
    },
  },
  github: {
    dir: "apps/sandbox",
    owner: "haydenbleasel",
    repo: "blume",
  },
  i18n: {
    defaultLocale: "en",
    fallbackLocale: "en",
    locales: [
      { code: "en", label: "English" },
      { code: "de", label: "Deutsch", style: "Informal du-form" },
    ],
  },
  lastModified: "git",
  logo: "/logo.svg",
  markdown: {
    code: { icons: true, wrap: true },
  },
  narration: true,
  navigation: {
    featured: [
      {
        href: "https://github.com/haydenbleasel/blume",
        icon: "github",
        label: "GitHub",
      },
    ],
    tabs: [
      { label: "Docs", path: "/docs" },
      { label: "API", path: "/api" },
      { label: "GraphQL", path: "/graphql" },
      { label: "Events", path: "/events" },
      { label: "Blog", path: "/blog" },
      { label: "Changelog", path: "/changelog" },
    ],
  },
  // On by default; spelled out here with its default limit.
  rateLimit: memory({ requests: 30, window: 600 }),
  redirects: [
    { from: "/start", to: "/docs" },
    { from: "/guides/:slug*", to: "/docs/guides/:slug*" },
  ],
  reference: [
    openapi({
      expandSchemas: true,
      route: "/api",
      spec: "./specs/openapi.yaml",
    }),
    asyncapi({
      sources: [{ label: "Commerce events", spec: "./specs/asyncapi.yaml" }],
    }),
    graphql({
      endpoint: "https://petstore.example.com/graphql",
      spec: "./specs/schema.graphql",
    }),
  ],
  search: {
    popular: [
      { href: "/docs", icon: "rocket", label: "Getting started" },
      { href: "/events", icon: "radio", label: "Event reference" },
      { href: "/api", icon: "braces", label: "API reference" },
    ],
  },
  seo: {
    x: { creator: "@haydenbleasel", handle: "@haydenbleasel" },
  },
  theme: {
    accent: "purple",
    radius: "lg",
  },
  title: "Blume Sandbox",
  variables: {
    "api-url": "https://api.acme.dev/v1",
    plan: "Team",
    version: "2.0",
  },
  versions: {
    archived: [{ id: "v1.0" }],
    current: { badge: "Latest", label: "v2.0" },
  },
});
