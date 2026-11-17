#!/bin/sh
set -eu
cd "$(dirname "$0")"
if ! command -v python3 >/dev/null 2>&1; then
  printf 'Python 3.9 or newer is required.\n' >&2
  exit 1
fi
if curl -fsS http://127.0.0.1:8765/api/bootstrap >/dev/null 2>&1; then
  open "http://127.0.0.1:8765/"
  exit 0
fi
printf 'Open http://127.0.0.1:8765/ once Syncdesk starts. Press Ctrl+C to stop it.\n'
exec python3 -B app.py
