"""Write the Bell to Bell code graph as an Obsidian vault folder.

Unlike graphify's stock exporter, every connection keeps its direction and its
label: outgoing links are Dataview inline fields (`[calls:: [[X]]]`), so the
Graph Link Types / Dataview plugins can draw the label on the edge, and incoming
links are listed with their inverse label ("called by"). Same-endpoint edges
that graphify's DiGraph would collapse are all kept, read from the raw
extraction.
"""
import json, copy, re, sys, math, collections, os
from pathlib import Path
from graphify.build import build_from_json

BUILD = Path(sys.argv[1])          # dir holding graphify-out/
OUT = Path(sys.argv[2])            # vault folder to write (e.g. <vault>/Code Graph)
PREFIX = sys.argv[3] if len(sys.argv) > 3 else 'Code Graph'   # path of OUT inside the vault
LABELS = json.loads(Path(sys.argv[4]).read_text()) if len(sys.argv) > 4 else {}

ex = json.loads((BUILD / 'graphify-out/.graphify_extract.json').read_text())
an = json.loads((BUILD / 'graphify-out/.graphify_analysis.json').read_text())
G = build_from_json(copy.deepcopy(ex), root=os.environ['REPO_ROOT'], directed=True)
N = {n: dict(G.nodes[n]) for n in G.nodes}
for n in ex['nodes']:              # keep attributes build may drop (rationale)
    if n['id'] in N and n.get('rationale'):
        N[n['id']]['rationale'] = n['rationale']
comm_of = {n: int(c) for c, ms in an['communities'].items() for n in ms}
cname = {int(c): LABELS.get(c, f'Community {c}') for c in an['communities']}
cohesion = {int(k): v for k, v in an['cohesion'].items()}

# --- relation vocabulary: forward label, inverse label, plain-English meaning
REL = {
    'contains':          ('contains', 'defined in', 'the file or scope defines this symbol'),
    'method':            ('has method', 'method of', 'the class defines this method'),
    'calls':             ('calls', 'called by', 'runs this function (same file: parsed; across files: through the BTB namespace)'),
    'indirect_call':     ('may call', 'may be called by', 'passes this function along as a callback or stores it in a list, so it probably runs later (inferred)'),
    'imports':           ('imports', 'imported by', 'Node require() of a named export'),
    'imports_from':      ('imports from', 'imported by', 'Node require() of a whole module'),
    'uses':              ('uses', 'used by', 'reads a value or object another file published on BTB'),
    'instantiates':      ('instantiates', 'instantiated by', 'creates an object with new'),
    'depends_on':        ('depends on', 'needed by', 'file-level summary: this file reads things the other file published on BTB'),
    'loads_script':      ('loads script', 'loaded by', 'the HTML page loads this script with a <script> tag, in order'),
    'loads_stylesheet':  ('loads stylesheet', 'stylesheet of', 'the HTML page loads this CSS file'),
    'reads_tokens_from': ('reads tokens from', 'tokens read by', 'the CSS uses var(--...) colours/sizes defined in tokens.css'),
    'declares_font':     ('declares font', 'font declared in', 'the CSS registers this font face'),
    'creates':           ('creates', 'created by', 'this file creates the shared namespace object'),
    'publishes_to':      ('publishes to', 'receives exports from', 'this file hangs its exports on the shared BTB namespace'),
    'describes':         ('describes', 'described in', 'the design doc explains this idea'),
    'implemented_in':    ('implemented in', 'implements', 'this idea from the docs is built in that code'),
    'conceptually_related_to': ('related to', 'related to', 'the docs tie these two ideas together'),
}

# --- note names: readable and unique
method_owner = {}
for e in ex['edges']:
    if e['relation'] == 'method':
        method_owner[e['target']] = e['source']

def kind(nid):
    d = N[nid]
    ft = d.get('file_type')
    if ft == 'document':
        return 'document'
    if ft == 'concept':
        if nid.startswith('ref_'):
            return 'external module'
        if nid.startswith('css_fonts_'):
            return 'font'
        if nid == 'btb_namespace':
            return 'namespace'
        return 'concept'
    lab = d['label']
    if lab.endswith('.html'):
        return 'page'
    if lab.endswith('.css'):
        return 'stylesheet'
    if lab.endswith('.js'):
        return 'file'
    if nid in method_owner:
        return 'method'
    if lab.endswith('()'):
        return 'function'
    if d.get('_callable_class') or (lab[:1].isupper() and not lab.startswith('{')):
        return 'class or object'
    return 'value'

BAD = re.compile(r'[\\/:*?"<>|#^\[\]]')
def safe(s):
    s = BAD.sub('', s).replace('{', '(').replace('}', ')').strip()
    return re.sub(r'\s+', ' ', s)[:120] or 'unnamed'

def base_name(nid):
    d, k = N[nid], kind(nid)
    lab = d['label']
    src = d.get('source_file') or ''
    if k in ('file', 'page', 'stylesheet', 'document', 'concept', 'external module', 'font', 'namespace'):
        return safe(lab)
    fname = Path(src).name
    if k == 'method':
        owner = N[method_owner[nid]]['label']
        return safe(f'{fname} · {owner}{lab}')
    return safe(f'{fname} · {lab}')

names, used = {}, collections.Counter()
for nid in sorted(N, key=lambda n: (kind(n) not in ('file', 'page'), n)):
    b = base_name(nid)
    if kind(nid) in ('file',) and used[b.lower()]:
        b = safe(N[nid]['source_file'].replace('/', ' › '))
    cand, i = b, 2
    while cand.lower() in used:
        cand, i = f'{b} ({i})', i + 1
    used[cand.lower()] += 1
    names[nid] = cand

# community note names
cnote = {c: safe(f'_COMMUNITY_{cname[c]}') for c in cname}

# --- edges, uncollapsed, deduped on (source, target, relation, context)
out_e, in_e = collections.defaultdict(list), collections.defaultdict(list)
seen = set()
for e in ex['edges']:
    s, t, r = e['source'], e['target'], e['relation']
    k = (s, t, r, e.get('context'))
    if k in seen or s not in N or t not in N:
        continue
    seen.add(k)
    out_e[s].append(e)
    if s != t:
        in_e[t].append(e)

def detail(e):
    bits = []
    ctx = e.get('context')
    if ctx and ctx not in ('call', 'argument', 'collection'):
        bits.append(ctx)
    elif ctx in ('argument', 'collection'):
        bits.append('passed as ' + ('an argument' if ctx == 'argument' else 'a list entry'))
    if e.get('source_location'):
        bits.append('line ' + e['source_location'].lstrip('L'))
    if e.get('confidence') == 'INFERRED':
        bits.append(f"inferred, {e.get('confidence_score', 0):.2f}")
    return ' · '.join(bits)

REL_ORDER = list(REL)
def sort_key(e, other):
    return (REL_ORDER.index(e['relation']) if e['relation'] in REL_ORDER else 99, names[other].lower())

notes_dir = OUT / 'Nodes'
notes_dir.mkdir(parents=True, exist_ok=True)
(OUT / 'Communities').mkdir(parents=True, exist_ok=True)

def tagify(s):
    return re.sub(r'[^A-Za-z0-9_/-]+', '-', s).strip('-')

for nid, d in N.items():
    k = kind(nid)
    c = comm_of.get(nid)
    lines = ['---', f'type: "{k}"']
    if d.get('source_file'):
        lines.append(f'source_file: "{d["source_file"]}"')
    if d.get('source_location'):
        lines.append(f'line: {d["source_location"].lstrip("L")}')
    if c is not None:
        lines.append(f'community: "{cname[c]}"')
    lines += ['tags:', f'  - graph/{tagify(k)}']
    if c is not None:
        lines.append(f'  - community/{tagify(cname[c])}')
    lines += ['---', '', f'# {names[nid]}', '']
    where = []
    if d.get('source_file'):
        loc = f" line {d['source_location'].lstrip('L')}" if d.get('source_location') else ''
        where.append(f"**{k.capitalize()}** in `{d['source_file']}`{loc}.")
    else:
        where.append(f'**{k.capitalize()}**.')
    if c is not None:
        where.append(f'Group: [[{cnote[c]}|{cname[c]}]].')
    lines.append(' '.join(where))
    if d.get('rationale'):
        lines += ['', f"> {d['rationale']}"]
    lines.append('')
    outs = sorted(out_e.get(nid, []), key=lambda e: sort_key(e, e['target']))
    if outs:
        lines.append('## Points to')
        for e in outs:
            fwd = REL.get(e['relation'], (e['relation'],))[0]
            if e['target'] == nid:
                lines.append(f'- {fwd} itself (recursion)' + (f' _({detail(e)})_' if detail(e) else ''))
                continue
            dt = detail(e)
            lines.append(f'- [{fwd}:: [[{names[e["target"]]}]]]' + (f' _({dt})_' if dt else ''))
        lines.append('')
    ins = sorted(in_e.get(nid, []), key=lambda e: sort_key(e, e['source']))
    if ins:
        lines.append('## Pointed to by')
        for e in ins:
            inv = REL.get(e['relation'], (None, e['relation']))[1]
            dt = detail(e)
            lines.append(f'- {inv} ← [[{names[e["source"]]}]]' + (f' _({dt})_' if dt else ''))
        lines.append('')
    (notes_dir / f'{names[nid]}.md').write_text('\n'.join(lines))

# --- community notes
members_by_c = collections.defaultdict(list)
for n, c in comm_of.items():
    if n in N:
        members_by_c[c].append(n)
cross = collections.defaultdict(collections.Counter)
for e in ex['edges']:
    a, b = comm_of.get(e['source']), comm_of.get(e['target'])
    if a is not None and b is not None and a != b:
        cross[a][b] += 1
for c, ms in members_by_c.items():
    files = collections.Counter(N[m].get('source_file') or '(external)' for m in ms)
    lines = ['---', 'type: "community"', f'members: {len(ms)}', f'cohesion: {cohesion.get(c, 0):.2f}', '---', '',
             f'# {cname[c]}', '', f'{len(ms)} pieces of code that talk to each other more than to anything else.', '',
             '**Mostly from:** ' + ', '.join(f'`{f}` ({n})' for f, n in files.most_common(4)), '']
    if cross[c]:
        lines.append('## Links to other groups')
        for o, cnt in cross[c].most_common():
            lines.append(f'- [links to:: [[{cnote[o]}|{cname[o]}]]] _({cnt} connections)_')
        lines.append('')
    lines.append('## Members')
    by_kind = collections.defaultdict(list)
    for m in ms:
        by_kind[kind(m)].append(m)
    for kd in sorted(by_kind, key=lambda x: ['file', 'page', 'stylesheet', 'document', 'concept', 'class or object', 'function', 'method'].index(x) if x in ['file', 'page', 'stylesheet', 'document', 'concept', 'class or object', 'function', 'method'] else 99):
        lines.append(f'### {kd.capitalize()}')
        for m in sorted(by_kind[kd], key=lambda m: names[m].lower()):
            lines.append(f'- [[{names[m]}]]')
        lines.append('')
    (OUT / 'Communities' / f'{cnote[c]}.md').write_text('\n'.join(lines))

# --- canvases: architecture views with every edge labelled
FOLDER_ORDER = ['(root)', 'css', 'js', 'js/core', 'js/art', 'js/market', 'js/trading', 'js/audio', 'js/ui',
                'js/modes/story', 'js/modes/endless', 'js/tests', 'docs']
COLORS = {'(root)': '6', 'css': '5', 'js': '1', 'js/core': '4', 'js/art': '3', 'js/market': '2', 'js/trading': '2',
          'js/audio': '5', 'js/ui': '6', 'js/modes/story': '1', 'js/modes/endless': '3', 'js/tests': '4', 'docs': '6'}

def folder(nid):
    src = N[nid].get('source_file') or ''
    if kind(nid) == 'document':
        return 'docs'
    p = str(Path(src).parent)
    return '(root)' if p == '.' else p

def canvas(path, node_ids, edges, label_fn):
    groups = collections.defaultdict(list)
    for n in node_ids:
        groups[folder(n)].append(n)
    order = [f for f in FOLDER_ORDER if f in groups] + sorted(f for f in groups if f not in FOLDER_ORDER)
    cols = 4
    cw, ch, gap = 260, 70, 30
    cn, x0, y0, rowh = [], 0, 0, 0
    col = 0
    for f in order:
        ms = sorted(groups[f], key=lambda n: names[n].lower())
        inner = min(3, len(ms)) or 1
        rows = math.ceil(len(ms) / inner)
        gw, gh = inner * (cw + gap) + gap, rows * (ch + gap) + gap + 40
        cn.append({'id': 'g_' + f, 'type': 'group', 'label': f, 'x': x0, 'y': y0, 'width': gw, 'height': gh,
                   'color': COLORS.get(f, '0')})
        for i, m in enumerate(ms):
            cn.append({'id': 'n_' + m, 'type': 'file', 'file': f'{PREFIX}/Nodes/{names[m]}.md',
                       'x': x0 + gap + (i % inner) * (cw + gap), 'y': y0 + 40 + gap + (i // inner) * (ch + gap),
                       'width': cw, 'height': ch})
        rowh = max(rowh, gh)
        col += 1
        x0 += gw + 120
        if col == cols:
            col, x0, y0, rowh = 0, 0, y0 + rowh + 120, 0
    ce = []
    for i, e in enumerate(edges):
        ce.append({'id': f'e{i}', 'fromNode': 'n_' + e['source'], 'toNode': 'n_' + e['target'],
                   'fromSide': 'right', 'toSide': 'left', 'toEnd': 'arrow', 'label': label_fn(e)})
    (OUT / path).write_text(json.dumps({'nodes': cn, 'edges': ce}, indent=1))
    return len(cn), len(ce)

file_like = [n for n in N if kind(n) in ('file', 'page', 'stylesheet')]
dep_edges = [e for e in ex['edges'] if e['relation'] in ('depends_on', 'imports_from', 'reads_tokens_from')
             and e['source'] in file_like and e['target'] in file_like]
def dep_label(e):
    if e['relation'] == 'depends_on':
        syms = e['context'].replace('via ', '')
        return 'uses ' + (syms if len(syms) < 60 else syms[:57] + '…')
    return REL[e['relation']][0]
print('architecture canvas', canvas('Architecture - who uses whom.canvas', file_like, dep_edges, dep_label))

load_edges = [e for e in ex['edges'] if e['relation'] in ('loads_script', 'loads_stylesheet') and e['source'] == 'index']
load_nodes = ['index'] + [e['target'] for e in load_edges]
print('load canvas', canvas('Architecture - page load order.canvas', load_nodes, load_edges,
                            lambda e: f"{REL[e['relation']][0]} · {e['context']}"))

concept_nodes = [n for n in N if kind(n) in ('concept', 'document')]
concept_edges = [e for e in ex['edges'] if e['relation'] in ('describes', 'implemented_in', 'conceptually_related_to')]
targets = {e['target'] for e in concept_edges} | {e['source'] for e in concept_edges}
cn_nodes = sorted(set(concept_nodes) | targets)
print('concept canvas', canvas('Design ideas - where they live in code.canvas', cn_nodes, concept_edges,
                               lambda e: REL[e['relation']][0]))

# --- start-here note
rel_counts = collections.Counter(e['relation'] for e in ex['edges'])
kinds = collections.Counter(kind(n) for n in N)
L = ['# Bell to Bell · Code Graph', '',
     'A map of the whole Bell to Bell codebase, built with **graphify** and extended so every connection has a label and a direction.', '',
     f'- **{len(N)} notes**, one per file, class, function, method, stylesheet, font and design idea',
     f'- **{len(seen)} labelled connections**',
     f'- **{len(cname)} groups** of code that work closely together', '',
     '## Start here', '',
     '- [[Architecture - who uses whom.canvas|Architecture: who uses whom]]: every source file and the arrows between them, each arrow labelled with what is borrowed',
     '- [[Architecture - page load order.canvas|Architecture: page load order]]: what `index.html` loads, step by step',
     '- [[Design ideas - where they live in code.canvas|Design ideas: where they live in code]]: README and art direction ideas tied to the files that build them',
     "- [[Graphify Report]]: graphify's own summary (most connected code, surprising links)",
     '- Graph view: press `Ctrl/Cmd + G`', '',
     '## Groups', '']
for c in sorted(cname, key=lambda c: -len(members_by_c[c])):
    L.append(f'- [[{cnote[c]}|{cname[c]}]] ({len(members_by_c[c])})')
L += ['', '## How to read a note', '',
      'Each note has two lists:', '',
      '- **Points to**: connections leaving this piece of code, written like `calls → draw()`.',
      '- **Pointed to by**: connections arriving, written with the reverse label, like `called by ← news()`.', '',
      'Grey text after a link tells you *which* shared name was used (for example `BTB.Pixel.text`), the line number, and whether the link is inferred.', '',
      '## What each label means', '', '| Label | Reverse label | Meaning | Count |', '|---|---|---|---|']
for r, (f, i, m) in REL.items():
    if rel_counts.get(r):
        L.append(f'| {f} | {i} | {m} | {rel_counts[r]} |')
L += ['', '## Seeing labels on the graph lines', '',
      "Obsidian's built-in graph view draws lines but never prints labels on them. The labels are always in each note and on the canvases. To also see them on the graph view:", '',
      '1. Settings → Community plugins → turn on community plugins.',
      '2. Browse → install and enable **Dataview**.',
      '3. Browse → install and enable **Graph Link Types**.',
      '4. Open the graph view. Each line now shows its label (calls, uses, depends on, …).', '',
      '## Why "BTB"?', '',
      'The game has no imports between files. `js/core/util.js` creates one shared object, `window.BTB`, and every other file puts its parts on it (`BTB.Market`, `BTB.Broker`, …) and reads other files\' parts back off it. graphify\'s automatic pass cannot see those links, so they were added by scanning every `BTB.` reference and tracing it to where it was defined. They are marked as extracted from the source, not guessed.', '',
      '## What is in the graph', '', '| Kind | Count |', '|---|---|']
for kd, n in kinds.most_common():
    L.append(f'| {kd} | {n} |')
L += ['', '## Known gaps', '',
      '- Calls made through an object stored in a variable (for example `game.js` running `this.market.step()`) are not traced, because the code never names `BTB.Market` at that spot. The file-level link (`game.js` depends on `engine.js`) is still there.',
      '- Fonts (`.woff2`) and screenshots are not parsed. The CSS files are included as notes, with their links to fonts and palette tokens.',
      '- Design idea links marked "inferred" are judgement calls from reading the README and art direction doc against the code. Everything else is read straight from the source.']
(OUT / '00 Start Here.md').write_text('\n'.join(L) + '\n')
print(len(N), 'node notes,', len(members_by_c), 'community notes,', len(seen), 'edges written')
