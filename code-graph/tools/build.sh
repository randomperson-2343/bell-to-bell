#!/usr/bin/env bash
# Rebuild the Obsidian code graph in code-graph/.
# Needs Python 3.10+ and graphify:  pip install graphifyy
set -euo pipefail
TOOLS="$(cd "$(dirname "$0")" && pwd)"
export REPO_ROOT="$(cd "$TOOLS/../.." && pwd)"
export LABELS="$TOOLS/labels.json"
OUT="$REPO_ROOT/code-graph"
W="$(mktemp -d)"
trap 'rm -rf "$W"' EXIT
cd "$W"

# 1. graphify's structural pass (tree-sitter AST, no API key needed)
graphify extract "$REPO_ROOT" --code-only --out "$W/g"
# 2. the cross-file BTB namespace wiring graphify cannot see, pages and CSS
python3 "$TOOLS/augment.py" "$REPO_ROOT" g/graphify-out/graph.json wiring.json
# 3. design ideas from README.md and ART_DIRECTION.md
python3 "$TOOLS/docs_fragment.py" docs.json
# 4. merge, then graphify's build + clustering + report
mkdir -p build/graphify-out
python3 "$TOOLS/merge.py"
(cd build && python3 "$TOOLS/cluster.py" > /dev/null && python3 "$TOOLS/report.py")
(cd build && graphify export html --graph graphify-out/graph.json --labels graphify-out/.graphify_labels.json)
# 5. the vault folder with labelled, directed links + canvases
rm -rf "$OUT/Code Graph"
python3 "$TOOLS/write_vault.py" build "$OUT/Code Graph" "Code Graph" "$LABELS"
cp build/graphify-out/GRAPH_REPORT.md "$OUT/Code Graph/Graphify Report.md"
mkdir -p "$OUT/graphify-out"
cp build/graphify-out/{graph.json,graph.html,GRAPH_REPORT.md} "$OUT/graphify-out/"
echo "Done: $OUT/Code Graph"
