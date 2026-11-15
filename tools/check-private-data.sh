#!/usr/bin/env bash
# Fails when tracked files contain personal data that must never be in this repository.
# Checked: e-mail addresses (except GitHub noreply and the AI co-author address), phone-number-like strings
# in docs, and absolute Windows user paths (they contain the account name).
# Run locally with: bash tools/check-private-data.sh
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

status=0

# Every tracked text file. Binary files (images, fonts, sounds) are skipped by grep -I.
files=$(git ls-files | grep -v -E '\.(png|jpg|jpeg|gif|ttf|otf|mp3|ogg|wav|ico)$' || true)

if [ -z "$files" ]; then
  echo "no tracked files"
  exit 0
fi

# 1. E-mail addresses that are not an allowed machine address.
emails=$(echo "$files" | xargs grep -I -n -o -E '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' 2>/dev/null \
  | grep -v -E 'users\.noreply\.github\.com|noreply@anthropic\.com|@example\.(com|org)|@scope|@/' || true)
if [ -n "$emails" ]; then
  echo "ERROR: e-mail address found:"
  echo "$emails"
  status=1
fi

# 2. Absolute user-profile paths leak the account name.
paths=$(echo "$files" | xargs grep -I -n -E '([A-Za-z]:\\\\?|/)(Users|home)[\\/][A-Za-z0-9._-]+' 2>/dev/null \
  | grep -v -E 'check-private-data\.sh' || true)
if [ -n "$paths" ]; then
  echo "ERROR: user profile path found:"
  echo "$paths"
  status=1
fi

# 3. Phone-number-like strings (10+ digits with separators) in docs.
phones=$(echo "$files" | grep -E '\.md$' | xargs grep -I -n -E '(\+|00)[0-9][0-9 ()./-]{8,}[0-9]' 2>/dev/null || true)
if [ -n "$phones" ]; then
  echo "ERROR: phone-number-like string found:"
  echo "$phones"
  status=1
fi

if [ "$status" -eq 0 ]; then
  echo "private data scan: clean"
fi
exit "$status"
