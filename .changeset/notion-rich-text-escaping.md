---
"blume": patch
---

Pages from a `notion()` source now keep the text written in Notion as text. Notion pages are written as MDX, and the rich text went in unescaped, so a literal `{` in a paragraph opened a JSX expression that failed the whole page and a `<b>` became a real tag; each run is now escaped like the other CMS sources, and a run whose edge is a space keeps it outside its bold or italic markers. Code blocks keep their text verbatim in a fence longer than any backticks inside, and a page title, description, or slug, a toggle's title, and an image's alt text take the plain text instead of Markdown marks. A paragraph that opens with `import ` or `export ` no longer fails the page as an MDX import, and a line of only `-` or `=` or a typed `&copy;` stays text.
