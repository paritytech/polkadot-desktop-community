#!/usr/bin/env bash
# Stop hook. Formats every file the turn actually dirtied, as decided by git.
#
# Replaces the old PostToolUse(Edit|Write|MultiEdit) formatter, which was blind to
# any edit that did not go through those tools — `sed -i`, a codemod, a generator,
# anything run via Bash. That blind spot is what shipped unformatted files to CI.
# git sees all of them, whoever wrote them.
#
# Running once at end of turn also stops Prettier from reformatting a file
# between two edits to it, which invalidated the old string in the second edit.
#
# Best-effort and non-blocking: errors silenced, always exits 0.

set -uo pipefail

cd "$CLAUDE_PROJECT_DIR" || exit 0

# While the `architect` agent runs a change (CLAUDE.md § Project agent), its implementers edit
# files in this same checkout. Formatting them at the end of a main-session turn would change a
# file between an implementer's read and its edit. Their commits format through lint-staged.
[[ -f docs/_plans/project-agent.md ]] && exit 0

prettier="$CLAUDE_PROJECT_DIR/node_modules/.bin/prettier"
[[ -x "$prettier" ]] || exit 0

# Tracked modifications (renames report the new path) plus untracked additions.
# NUL-separated so paths with spaces survive.
{
    git diff --name-only -z HEAD 2>/dev/null
    git ls-files --others --exclude-standard -z 2>/dev/null
} | sort -zu | while IFS= read -r -d '' file; do
    [[ -f "$file" ]] || continue          # skip deletions
    "$prettier" --write --ignore-unknown "$file" 2>/dev/null
done

exit 0
