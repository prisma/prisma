---
description: Do not add backward-compatibility shims or migration scaffolding
globs: ["packages/**"]
alwaysApply: false
---

# No Backward Compatibility or Migration Paths

## Rule

**This project has no external consumers. Do NOT add:**
- Backward compatibility code or APIs
- Migration paths or deprecation warnings
- Comments explaining "legacy" or "old" vs "new" approaches
- Test fixtures or examples showing old patterns alongside new ones
- Code comments documenting what changed or why it changed

## What to Do Instead

**Directly change the implementation:**
- Remove old code entirely
- Update all references to use the new approach
- Update design docs to reflect the current state (not the transition)
- Update tests to only test the current approach
- Delete obsolete examples or fixtures

## Rationale

Since this project has no external consumers, maintaining backward compatibility creates unnecessary complexity and technical debt. The codebase should reflect the current design, not preserve history of how it evolved.

## Examples

**Bad:**
- Adding "legacy" codecs alongside new ones
- Keeping old test fixtures "for reference"
- Comments like "Legacy support - will be removed in future"
- Deprecation warnings or migration helpers

**Good:**
- Delete old code completely
- Update all references immediately
- Update design docs to show current state only
- Tests only exercise current patterns
