---
"blume": patch
---

Every built-in component now reaches agents as Markdown in the `.md` mirrors, `llms-full.txt`, MCP `get_page`, and search. `Accordion`, `AccordionItem`, `Expandable`, `FileTree`, `Columns`, `CodeGroup`, `Frame`, `Panel`, `Tile`, `Update`, `Prompt`, `GithubInfo`, `CodeBlock`, `Diff`, `Math`, `Tree`, `Color`, `Badge`, `Icon`, and `Tooltip` used to be left as raw JSX; each now renders what the component shows — an accordion item as its title over its answer, a file tree as its list, a tooltip's tip after its trigger, a code block or diff as a fence. `AutoTypeTable`, whose table comes from type-checking a source file, stays as JSX. A nested list inside a component's body (a `Step` with sub-items, say) also keeps its indentation instead of flattening to one level.
