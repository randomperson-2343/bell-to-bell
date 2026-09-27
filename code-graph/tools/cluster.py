import json,copy,collections,os
from pathlib import Path
from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from graphify.analyze import god_nodes, surprising_connections
ex=json.loads(Path('graphify-out/.graphify_extract.json').read_text())
G=build_from_json(copy.deepcopy(ex), root=os.environ['REPO_ROOT'], directed=True)
comms=cluster(G); coh=score_all(G,comms)
an={'communities':{str(k):v for k,v in comms.items()},'cohesion':{str(k):v for k,v in coh.items()},'gods':god_nodes(G),'surprises':surprising_connections(G,comms)}
Path('graphify-out/.graphify_analysis.json').write_text(json.dumps(an,indent=1))
deg=dict(G.degree())
for k,v in sorted(comms.items()):
    fc=collections.Counter(G.nodes[n].get('source_file') or 'ext' for n in v).most_common(5)
    top=sorted(v,key=lambda n:-deg[n])[:8]
    print(k,len(v),round(coh[k],2),fc,'|',[G.nodes[n]['label'] for n in top])
