# Code graph

An Obsidian map of this codebase, built with [graphify](https://pypi.org/project/graphifyy/).

- `Code Graph/`: the Obsidian folder. Drop it into any vault and open `00 Start Here`.
- `graphify-out/`: graphify's raw `graph.json`, its `GRAPH_REPORT.md`, and `graph.html` (open in a browser).
- `tools/`: the scripts that build it.

Every connection has a direction and a label. Outgoing links are Dataview inline
fields (`[calls:: [[X]]]`), so with the Dataview and Graph Link Types plugins the
labels also show on Obsidian's graph view. The three `.canvas` files show them
without any plugin.

graphify's AST pass sees calls inside a file but not between files, because the
game shares code through the `window.BTB` namespace instead of imports.
`tools/augment.py` fills that in by tracing every `BTB.X` reference to the file
that defines it.

## Rebuild

```bash
pip install graphifyy
code-graph/tools/build.sh
```

Community names live in `tools/labels.json`, keyed by graphify's community
number. If the code changes enough that the groups shift, check the names still
fit.
