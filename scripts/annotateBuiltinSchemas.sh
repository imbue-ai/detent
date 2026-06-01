#!/usr/bin/env bash
#
# Annotate every built-in service schema with a "$comment" field.
#
# For each JSON file under src/schemas/builtin/, this calls `pi -p` and asks
# the agent to add a "$comment" to each top-level schema with a 1-2 sentence
# summary of what that schema matches.
#
# Usage:
#   scripts/annotateBuiltinSchemas.sh [file.json ...]
#
# With no arguments, all built-in schema files are processed.

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
schemas_dir="$script_dir/../src/schemas/builtin"

if [ "$#" -gt 0 ]; then
  files=("$@")
else
  files=("$schemas_dir"/*.json)
fi

read -r -d '' prompt <<'PROMPT' || true
This JSON file maps schema names to JSON-schema objects that match HTTP
requests for a particular service. For every top-level schema in the file,
add a "$comment" field whose value is a 1-2 sentence plain-English summary of
what that schema matches (which requests, methods, and paths it covers). If a
schema already has a "$comment", overwrite it. Make "$comment" the first key
of each schema object. Do not change any other part of the file and keep it
valid JSON. Avoid using technical jargon (mentioning request
parts) unless it naturally belongs to the service's domain (e.g.
a service that operates _on_ requests).

Make sure you read README.md first to understand the context.

Example for "slack-bookmarks-write": "Add, edit or remove bookmarks."
PROMPT

for file in "${files[@]}"; do
  echo "Annotating $file ..."
  pi --no-session -p "$prompt" "@$file"
done

echo "Done."
