#!/usr/bin/env bash
#
# git-calendar: Generate a beautiful calendar visualization of git history
#
# Usage: ./generate.sh [options]
#   --since "6 months ago"   How far back to look (default: 6 months ago)
#   --output calendar.html   Output file (default: git-calendar.html)
#   --no-open                Don't auto-open in browser
#
# Run this script from inside any git repository.

set -euo pipefail

SINCE="6 months ago"
OUTPUT="git-calendar.html"
AUTO_OPEN=true

while [[ $# -gt 0 ]]; do
  case $1 in
    --since) SINCE="$2"; shift 2 ;;
    --output) OUTPUT="$2"; shift 2 ;;
    --no-open) AUTO_OPEN=false; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Ensure we're in a git repo
if ! git rev-parse --is-inside-work-tree &>/dev/null; then
  echo "Error: Not inside a git repository"
  exit 1
fi

REPO_NAME=$(basename "$(git rev-parse --show-toplevel)")
REPO_PATH=$(git rev-parse --show-toplevel)

echo "Extracting git history for '$REPO_NAME' since '$SINCE'..."

# Extract git log as JSON-ish lines, then build a proper JSON array
# We use %x00 as delimiter to handle special chars in subjects
GIT_DATA=$(git log --all --format="%H%x00%h%x00%an%x00%ae%x00%aI%x00%s" --since="$SINCE" | \
  python3 -c "
import sys, json

commits = []
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    parts = line.split('\x00')
    if len(parts) < 6:
        continue
    hash_full, hash_short, author, email, date_iso, subject = parts[0], parts[1], parts[2], parts[3], parts[4], '\x00'.join(parts[5:])
    # Parse date
    date_part = date_iso[:10]
    time_part = date_iso[11:16] if len(date_iso) > 11 else '00:00'
    commits.append({
        'hash': hash_short,
        'author': author,
        'email': email,
        'date': date_part,
        'time': time_part,
        'subject': subject
    })

print(json.dumps(commits))
")

COMMIT_COUNT=$(echo "$GIT_DATA" | python3 -c "import sys,json; print(len(json.loads(sys.stdin.read())))")
echo "Found $COMMIT_COUNT commits."

# Get unique authors
AUTHORS=$(echo "$GIT_DATA" | python3 -c "
import sys, json
commits = json.loads(sys.stdin.read())
authors = {}
for c in commits:
    name = c['author']
    email = c['email']
    if name not in authors:
        authors[name] = {'name': name, 'email': email, 'count': 0}
    authors[name]['count'] += 1
# Sort by commit count descending
sorted_authors = sorted(authors.values(), key=lambda x: -x['count'])
print(json.dumps(sorted_authors))
")

# Read the HTML template
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="$SCRIPT_DIR/index.html"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "Error: Template file not found at $TEMPLATE"
  exit 1
fi

# Replace placeholders in template
sed \
  -e "s|__REPO_NAME__|$REPO_NAME|g" \
  -e "s|__GIT_DATA__|$GIT_DATA|g" \
  -e "s|__AUTHORS_DATA__|$AUTHORS|g" \
  -e "s|__COMMIT_COUNT__|$COMMIT_COUNT|g" \
  "$TEMPLATE" > "$OUTPUT"

echo "Generated: $OUTPUT"

# Open in browser
if $AUTO_OPEN; then
  if command -v xdg-open &>/dev/null; then
    xdg-open "$OUTPUT" 2>/dev/null &
  elif command -v open &>/dev/null; then
    open "$OUTPUT"
  else
    echo "Open $OUTPUT in your browser to view."
  fi
fi
