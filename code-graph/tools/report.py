"""graphify's own summary report + graph.json/graph.html, with the community names."""
import json, copy, os
from pathlib import Path
from graphify.build import build_from_json
from graphify.analyze import suggest_questions
from graphify.report import generate
from graphify.export import to_json
from graphify.detect import detect

root = os.environ['REPO_ROOT']
ex = json.loads(Path('graphify-out/.graphify_extract.json').read_text())
an = json.loads(Path('graphify-out/.graphify_analysis.json').read_text())
labels = {int(k): v for k, v in json.loads(Path(os.environ['LABELS']).read_text()).items()}
G = build_from_json(copy.deepcopy(ex), root=root, directed=True)
comms = {int(k): v for k, v in an['communities'].items()}
coh = {int(k): v for k, v in an['cohesion'].items()}
q = suggest_questions(G, comms, labels)
rep = generate(G, comms, coh, labels, an['gods'], an['surprises'], detect(Path(root)),
               {'input': 0, 'output': 0}, root, suggested_questions=q)
Path('graphify-out/GRAPH_REPORT.md').write_text(rep)
Path('graphify-out/.graphify_labels.json').write_text(json.dumps({str(k): v for k, v in labels.items()}))
to_json(G, comms, 'graphify-out/graph.json', community_labels=labels)
