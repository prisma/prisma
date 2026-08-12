---
name: multiline-commit-messages
description: >-
  Use single-quoted strings for multiline git commit messages in the Shell tool.
  Prevents heredoc escaping failures that produce garbled commit messages.
---

# Multiline commit messages

The Shell tool sends commands as a single string. Heredoc syntax (`<<'EOF'`) inside `$(cat ...)` is fragile and fails silently — the literal `$(cat <<'EOF' ...` ends up as the commit message instead of the intended text.

## Rule

**Never** use `$(cat <<'EOF' ...)` or `$(cat <<EOF ...)` for commit messages.

Use single-quoted strings with embedded newlines:

```bash
git commit -m 'short summary line

Longer body paragraph explaining why the change exists.
Additional context if needed.'
```

## Why heredocs fail

The Shell tool passes the command as a single string argument. When you write:

```bash
git commit -m "$(cat <<'EOF'
message
EOF
)"
```

The shell may not parse the heredoc correctly in this context — the `EOF` delimiter, newlines, and nested quoting interact unpredictably. The result is the raw `$(cat <<'EOF' ...` text appearing as the commit message.

Single-quoted strings with literal newlines are simple, portable, and always work.
