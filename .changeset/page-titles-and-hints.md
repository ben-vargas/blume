---
"blume": patch
---

A heading inside a multi-line HTML (`<!-- … -->`) or MDX (`{/* … */}`) comment no longer becomes the page title, a table of contents entry, or a link anchor. Titles derived from file names spell acronyms the way sidebar groups do (`faq.md` is "FAQ"), and an untitled folder `index` page takes its folder's label instead of "Index". A root file named like a version (`v3-migration.md`) no longer triggers the unconfigured-version warning, and the missing content root hint now names the `filesystem()` source's `root` for projects that list `content.sources`.
