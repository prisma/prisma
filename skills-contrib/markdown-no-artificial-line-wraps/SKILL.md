---
name: markdown-no-artificial-line-wraps
description: >-
  Writes and edits Markdown without inserting manual hard line breaks at a fixed column
  (e.g. 72 or 80). GitHub, docs sites, and editors soft-wrap prose; artificial breaks make
  diffs noisy and reflow awkward. Use when creating or editing .md files, PR bodies, ADRs,
  READMEs, rulecards, or any Markdown where the user cares about readable source and clean
  diffs — or when the user asks to avoid "hard wrapping" or "80-column" line breaks in prose.
---

# Markdown: no artificial line wraps

## Instructions

1. **Prose paragraphs** — Keep each paragraph as **one line** (or join wrapped lines into one) so the renderer can wrap in the viewer. Do not break lines mid-sentence to stay under ~80 characters.

2. **When hard newlines are correct**
   - **Lists**: one line per list item is fine; keep item text on one line unless the item is genuinely multiple paragraphs.
   - **Headings**: single line.
   - **Fenced code blocks**: preserve author intent; do not reflow code to 80 cols.
   - **Tables, block quotes, HTML**: follow normal Markdown rules; table rows may be long.
   - **Poetry / intentional line breaks**: keep explicit breaks where semantics require them.

3. **Links and emphasis** — Prefer not splitting a paragraph so that a `[text](url)` link is alone on a continuation line in a way that obscures reading; the whole paragraph can be one line.

4. **Rationale** — GitHub and most Markdown renderers wrap to the viewport. Fixed-width breaks in source only help in raw terminals; they harm `git diff` and merge conflict resolution.

## Don’t

- Reformat existing Markdown by hard-wrapping every paragraph to 80 columns unless the user explicitly asks for that style in that file.
- Apply this rule to non-Markdown formats (e.g. `.ts` comment blocks) unless the user asks for Markdown-style prose there.
