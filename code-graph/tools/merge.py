import json
ast=json.load(open('g/graphify-out/graph.json'))
w=json.load(open('wiring.json')); d=json.load(open('docs.json'))
relabel=w.pop('relabel')
nodes=[dict(n) for n in ast['nodes']]
for n in nodes:
    if n['id'] in relabel: n['label']=relabel[n['id']]; n['file_type']='concept'
seen={n['id'] for n in nodes}
for frag in (w,d):
    for n in frag['nodes']:
        if n['id'] not in seen: nodes.append(n); seen.add(n['id'])
edges=list(ast['links'])+w['edges']+d['edges']
assert all(e['source'] in seen and e['target'] in seen for e in edges)
json.dump({'nodes':nodes,'edges':edges,'hyperedges':[],'input_tokens':0,'output_tokens':0},open('build/graphify-out/.graphify_extract.json','w'),indent=1)
print(len(nodes),'nodes',len(edges),'edges')
