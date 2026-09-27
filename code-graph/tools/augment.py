"""Add the cross-file wiring graphify's AST pass cannot see.

Bell to Bell has no imports: every file is an IIFE that hangs its exports on a
shared namespace (window.BTB, passed in as `B`) and reads other files' exports
back off it. This scans for those `B.X = ...` definitions and `B.X` / `BTB.X`
reads, resolves them to graphify node ids, and emits a graphify extraction
fragment (nodes + edges) so the merge/build/cluster steps treat it like any
other semantic chunk.
"""
import json, re, sys
from pathlib import Path
import tree_sitter_javascript as tsjs
from tree_sitter import Language, Parser

ROOT = Path(sys.argv[1])
AST_GRAPH = Path(sys.argv[2])
OUT = Path(sys.argv[3])

g = json.loads(AST_GRAPH.read_text())
nodes = {n['id']: n for n in g['nodes']}
by_file = {}
for n in g['nodes']:
    by_file.setdefault(n['source_file'], []).append(n)

def stem_id(rel):
    p = Path(rel).with_suffix('')
    return '_'.join(re.sub(r'[^a-z0-9]', '_', s.lower()) for s in p.parts)

def norm(s):
    return re.sub(r'[^a-z0-9]', '_', s.lower())

parser = Parser(Language(tsjs.language()))
FUNC_TYPES = {'function_declaration', 'method_definition', 'function_expression',
              'arrow_function', 'generator_function_declaration', 'class_declaration'}

def func_spans(src):
    """(start_line, end_line, name) for every named function-like node."""
    tree = parser.parse(src)
    spans = []
    stack = [tree.root_node]
    while stack:
        n = stack.pop()
        stack.extend(n.children)
        if n.type not in FUNC_TYPES:
            continue
        name = n.child_by_field_name('name')
        if name is None and n.parent is not None:
            p = n.parent
            if p.type == 'variable_declarator':
                name = p.child_by_field_name('name')
            elif p.type == 'pair':
                name = p.child_by_field_name('key')
            elif p.type == 'assignment_expression':
                name = p.child_by_field_name('left')
                if name is not None and name.type == 'member_expression':
                    name = name.child_by_field_name('property')
        if name is None:
            continue
        spans.append((n.start_point[0] + 1, n.end_point[0] + 1, name.text.decode()))
    return spans

def enclosing_node(rel, line, spans):
    """Innermost function span containing `line` that graphify also has a node for."""
    fnodes = by_file.get(rel, [])
    best = None
    for s, e, name in spans:
        if not (s <= line <= e):
            continue
        for n in fnodes:
            if n.get('source_location') == f'L{s}' and norm(n['label'].strip('.()')) == norm(name):
                if best is None or s > best[0]:
                    best = (s, n['id'])
    return best[1] if best else stem_id(rel)

# index.html load order is the dependency order of the whole game.
html = (ROOT / 'index.html').read_text()
load_order = re.findall(r'<script src="([^"]+)"', html)
css_order = re.findall(r'<link rel="stylesheet" href="([^"]+)"', html)
tests_html = (ROOT / 'tests.html').read_text()
tests_order = re.findall(r'<script src="([^"]+)"', tests_html)

js_files = sorted(str(p.relative_to(ROOT)) for p in (ROOT / 'js').rglob('*.js'))

DEF_RE = re.compile(r'\bB\.([A-Za-z_$][\w$]*)\s*=(?!=)')
REF_RE = re.compile(r'(\bnew\s+)?\b(?:B|BTB)\.([A-Za-z_$][\w$]*)(?:\.([A-Za-z_$][\w$]*))?(\s*\()?')

# 1. who defines each namespace member (first definer in load order wins)
order_idx = {f: i for i, f in enumerate(load_order)}
definers = {}
for rel in sorted(js_files, key=lambda f: order_idx.get(f, 999)):
    src = (ROOT / rel).read_text()
    for m in DEF_RE.finditer(src):
        definers.setdefault(m.group(1), rel)

def resolve(member, prop, drel):
    ds = stem_id(drel)
    if prop and f'{ds}_{norm(prop)}' in nodes:
        return f'{ds}_{norm(prop)}', True
    if f'{ds}_{norm(member)}' in nodes:
        return f'{ds}_{norm(member)}', prop is None
    return ds, False

new_nodes, edges = [], []
seen = set()
def edge(s, t, rel, conf, score, src, loc, ctx=None):
    key = (s, t, rel)
    if key in seen or s == t:
        return
    seen.add(key)
    e = {'source': s, 'target': t, 'relation': rel, 'confidence': conf,
         'confidence_score': score, 'source_file': src, 'source_location': loc, 'weight': 1.0}
    if ctx:
        e['context'] = ctx
    edges.append(e)

# 2. every cross-file read, at function granularity + a file-level summary edge
file_deps = {}
for rel in js_files:
    src_b = (ROOT / rel).read_bytes()
    src = src_b.decode()
    spans = func_spans(src_b)
    line_starts = [0] + [i + 1 for i, c in enumerate(src) if c == '\n']
    import bisect
    for m in REF_RE.finditer(src):
        is_new, member, prop, call = m.group(1), m.group(2), m.group(3), m.group(4)
        drel = definers.get(member)
        if drel is None or drel == rel:
            continue
        # skip the definition site itself (`B.X = ...`)
        tail = src[m.end():m.end() + 3]
        if prop is None and not call and re.match(r'\s*=(?!=)', tail):
            continue
        line = bisect.bisect_right(line_starts, m.start())
        s = enclosing_node(rel, line, spans)
        t, exact = resolve(member, prop, drel)
        if is_new:
            r = 'instantiates'
        elif call and (prop is None or exact):
            r = 'calls'
        else:
            r = 'uses'
        conf, score = ('EXTRACTED', 1.0) if exact or t == stem_id(drel) else ('INFERRED', 0.95)
        edge(s, t, r, conf, score, rel, f'L{line}', f'BTB.{member}' + (f'.{prop}' if prop else ''))
        file_deps.setdefault((rel, drel), set()).add(member)

for (rel, drel), members in file_deps.items():
    edge(stem_id(rel), stem_id(drel), 'depends_on', 'EXTRACTED', 1.0, rel, None,
         'via BTB.' + ', BTB.'.join(sorted(members)))

# 3. page shells: index.html / tests.html load scripts and stylesheets in order
for page, scripts in (('index.html', load_order), ('tests.html', tests_order)):
    pid = stem_id(page)
    new_nodes.append({'id': pid, 'label': page, 'file_type': 'code', 'source_file': page, 'source_location': 'L1'})
    for i, s in enumerate(scripts, 1):
        edge(pid, stem_id(s), 'loads_script', 'EXTRACTED', 1.0, page, None, f'load step {i}')
for i, c in enumerate(css_order, 1):
    cid = stem_id(c)
    new_nodes.append({'id': cid, 'label': Path(c).name, 'file_type': 'code', 'source_file': c, 'source_location': 'L1'})
    edge('index', cid, 'loads_stylesheet', 'EXTRACTED', 1.0, 'index.html', None, f'stylesheet {i}')
# tokens.css defines the palette every other sheet reads through var(--...)
for c in css_order:
    if c.endswith('tokens.css'):
        continue
    if 'var(--' in (ROOT / c).read_text():
        edge(stem_id(c), stem_id('css/tokens.css'), 'reads_tokens_from', 'EXTRACTED', 1.0, c, None)
fonts_css = (ROOT / 'css/fonts.css').read_text()
for fam in sorted(set(re.findall(r"font-family:\s*'([^']+)'", fonts_css))):
    fid = 'css_fonts_' + norm(fam)
    new_nodes.append({'id': fid, 'label': f'{fam} (font)', 'file_type': 'concept', 'source_file': 'css/fonts.css', 'source_location': None})
    edge(stem_id('css/fonts.css'), fid, 'declares_font', 'EXTRACTED', 1.0, 'css/fonts.css', None)

# 4. the one namespace object everything hangs off
new_nodes.append({'id': 'btb_namespace', 'label': 'BTB namespace (window.BTB)', 'file_type': 'concept',
                  'source_file': 'js/core/util.js', 'source_location': 'L2'})
edge(stem_id('js/core/util.js'), 'btb_namespace', 'creates', 'EXTRACTED', 1.0, 'js/core/util.js', 'L2')
exports_by_file = {}
for member, drel in definers.items():
    exports_by_file.setdefault(drel, []).append(member)
for drel, members in exports_by_file.items():
    edge(stem_id(drel), 'btb_namespace', 'publishes_to', 'EXTRACTED', 1.0, drel, None,
         'BTB.' + ', BTB.'.join(sorted(members)))

# 5. human-friendly labels for the external modules the test runners import
EXT = {'ref_fs': 'fs (Node built-in)', 'ref_path': 'path (Node built-in)', 'ref_vm': 'vm (Node built-in)',
       'ref_crypto': 'crypto (Node built-in)', 'ref_child_process': 'child_process (Node built-in)',
       'ref_playwright': 'playwright (browser automation)', 'ref_napi_rs_canvas': '@napi-rs/canvas (image rendering)'}

OUT.write_text(json.dumps({'nodes': new_nodes, 'edges': edges, 'hyperedges': [],
                           'relabel': EXT, 'input_tokens': 0, 'output_tokens': 0}, indent=1))
from collections import Counter
print(len(new_nodes), 'nodes,', len(edges), 'edges')
print(Counter(e['relation'] for e in edges))
print(Counter(e['confidence'] for e in edges))
missing = {e['target'] for e in edges if e['target'] not in nodes} - {n['id'] for n in new_nodes}
missing |= {e['source'] for e in edges if e['source'] not in nodes} - {n['id'] for n in new_nodes}
print('unresolved endpoints:', sorted(missing))
