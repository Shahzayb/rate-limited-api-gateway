---
name: update-memory-bank
description: Review and update all memory-bank/ files after a task, or whenever the user says "update memory bank". Use after implementing changes to keep project context current.
---

Review and update the project's memory bank at `memory-bank/`. This mirrors the existing `.clinerules/` workflow used by Cline, applied the same way here.

1. Read all six memory-bank files first, in full, to understand current state:
   - `projectbrief.md`, `productContext.md`, `activeContext.md`, `systemPatterns.md`, `techContext.md`, `progress.md`

2. Review what changed in this session (recent edits, `git diff`/`git log` if useful) and update the relevant files:
   - New library/dependency added → `techContext.md`
   - New pattern or architectural decision → `systemPatterns.md`
   - New or changed config/env var → `techContext.md`
   - Any of the above occurred → also note it in `progress.md`
   - Otherwise → only update `activeContext.md` and `progress.md`
   - New plan file created this session → add a reference to it in the "Plan Files Reference" section of `productContext.md`

3. Keep edits concise and consistent with each file's existing structure and tone — these are living docs, not changelogs. Don't restate information that's still accurate; only add, correct, or remove what changed.

4. If a triggering task doesn't map cleanly onto these categories, ask before inventing a new section.
