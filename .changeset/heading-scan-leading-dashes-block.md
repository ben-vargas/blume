---
"blume": patch
---

A page body that opens with a `---` block (a `---` line, then anything up to the next `---` or `...` line) now has the headings its page renders. A `.md` page drops such a block when it renders, even when a blank line follows the opening dashes, so a heading inside it no longer passes `blume validate` as an anchor or titles an untitled page. An `.mdx` page renders the same lines as a divider and content, so a heading there, like `Intro` underlined by the closing `---`, is now an anchor `blume validate` accepts.
