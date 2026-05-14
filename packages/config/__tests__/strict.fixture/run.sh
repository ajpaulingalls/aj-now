#!/usr/bin/env bash
# Assert @aj-now/config/tsconfig.base enforces noUncheckedIndexedAccess.
# probe.ts intentionally violates the constraint; tsc MUST reject it with TS18048.
# If tsc passes, the constraint has been weakened — fail loudly.
set -uo pipefail

cd "$(dirname "$0")" || { echo "FAIL: could not cd to fixture dir"; exit 1; }
out=$(bunx --bun tsc --project tsconfig.json 2>&1)
status=$?

if [ "$status" -eq 0 ]; then
  echo "FAIL: tsc accepted probe.ts — noUncheckedIndexedAccess is no longer active"
  echo "$out"
  exit 1
fi

if ! echo "$out" | grep -q "TS18048"; then
  echo "FAIL: tsc rejected probe.ts but not for the expected reason (TS18048)"
  echo "$out"
  exit 1
fi

echo "ok: noUncheckedIndexedAccess enforced (TS18048 raised on a[0])"
