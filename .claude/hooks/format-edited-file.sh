#!/usr/bin/env bash
# PostToolUse hook for Edit|Write|MultiEdit.
# Formats EVERY edited file with Prettier so the working tree stays format-clean.
# Prettier respects .prettierignore, and --ignore-unknown skips file types it has
# no parser for. Best-effort and non-blocking: errors are silenced and the hook
# always exits 0, so a mid-edit syntax error never fails the tool call.

set -uo pipefail

input="$(cat)"
file_path="$(printf '%s' "$input" | jq -r '
    (.tool_input.file_path
        // .tool_response.filePath
        // .tool_input.path
        // empty)')"

[[ -z "$file_path" ]] && exit 0

prettier="$CLAUDE_PROJECT_DIR/node_modules/.bin/prettier"
[[ -x "$prettier" ]] || exit 0

# Silence errors only; the explicit `exit 0` below keeps the hook non-blocking
# even when Prettier exits non-zero on a mid-edit parse error.
"$prettier" --write --ignore-unknown "$file_path" 2>/dev/null
exit 0
