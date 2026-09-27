"""Semantic fragment for the two design docs (README.md, ART_DIRECTION.md).

Hand-extracted, following graphify's extraction spec: named concepts from the
docs, each tied to the code that implements it. EXTRACTED when the doc or the
file's own header comment names the file; INFERRED otherwise.
"""
import json, sys

R, A = 'README.md', 'ART_DIRECTION.md'
nodes = [
    {'id': 'readme', 'label': 'README.md', 'file_type': 'document', 'source_file': R},
    {'id': 'art_direction', 'label': 'ART_DIRECTION.md', 'file_type': 'document', 'source_file': A},
]
edges = []

def concept(cid, label, src, rationale, impl):
    """impl: list of (file_node_id, 'EXTRACTED'|'INFERRED')"""
    nodes.append({'id': cid, 'label': label, 'file_type': 'concept', 'source_file': src, 'rationale': rationale})
    edges.append({'source': 'readme' if src == R else 'art_direction', 'target': cid, 'relation': 'describes',
                  'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': src, 'weight': 1.0})
    for fid, conf in impl:
        edges.append({'source': cid, 'target': fid, 'relation': 'implemented_in', 'confidence': conf,
                      'confidence_score': 1.0 if conf == 'EXTRACTED' else 0.85, 'source_file': src, 'weight': 1.0})

X, I = 'EXTRACTED', 'INFERRED'
concept('concept_career_mode', 'Career mode (61 sessions, 22 endings)', R,
        '61 sessions over 13 weeks; 10 decisions reshape the market and route to one of 22 endings.',
        [('js_modes_story_story_engine', X), ('js_modes_story_story_data', X), ('js_modes_story_endings', X)])
concept('concept_endless_mode', 'Endless mode', R,
        'Random regimes and crash days with sliders; you pick win/lose conditions; local leaderboard per settings.',
        [('js_modes_endless_endless', X)])
concept('concept_deterministic_replay', 'Deterministic replay saves', R,
        'A day is reproducible from its seed, scenario and injected events, so a save stores only the clock and your book.',
        [('js_core_save', X), ('js_game', X), ('js_core_rng', X), ('js_market_engine', I)])
concept('concept_price_model', 'Factor price model', R,
        'price = prevClose * exp(beta*Market + Sector + Idiosyncratic), each factor anchored to a seeded Brownian bridge.',
        [('js_market_engine', X)])
concept('concept_circuit_breakers', 'Circuit breakers', R,
        'Market halts at -7% and -13%, closes at -20%; single stocks halt after a sudden 10% move.',
        [('js_market_engine', I), ('js_trading_broker', I)])
concept('concept_margin_calls', 'Margin calls and liquidation', R,
        'An alarm and countdown; if unfixed the risk desk liquidates your worst positions.',
        [('js_trading_broker', X)])
concept('concept_options', 'Simplified options', R,
        'Calls and puts, weekly and monthly expiries, priced with simplified Black-Scholes; long-only.',
        [('js_trading_options', X), ('js_ui_ticket', X)])
concept('concept_sqwak', 'Sqwak rumour network', R,
        'The rumour feed: big accounts can move a stock for minutes whether true or not; every account has a hidden accuracy record.',
        [('js_market_sqwak', X), ('js_modes_story_sqwak_story', X)])
concept('concept_phone_tips', 'Unreliable phone tips', R,
        'A tip resolves four ways (real, stale, reversal, false); roughly one in three pays.',
        [('js_interrupts', X)])
concept('concept_stress', 'Stress 2.0 and panic', R,
        'Stress escalates Loaded -> Tunnel -> Critical; panic attacks last under four seconds and A/S/D grounding ends them.',
        [('js_stress', X), ('js_ui_hud', I)])
concept('concept_quotas_strikes', 'Desk quotas and career strikes', R,
        'Daily and weekly quotas by market regime; each missed mandate is one permanent strike; the 30th ends the run.',
        [('js_modes_story_story_engine', I), ('js_game', I)])
concept('concept_personal_economy', 'Personal economy (wallet, draw, bonus, rent)', R,
        'The $250k book is the firm\'s; your wallet gets a weekly draw or bonus, pays rent and bills; being broke is never game over.',
        [('js_modes_story_economy', X)])
concept('concept_the_ledger', 'The Ledger subscription', R,
        'Paid morning desk note with the day\'s biggest scheduled moves, built from the session\'s own schedule.',
        [('js_modes_story_story_engine', I), ('js_ui_screens', I)])
concept('concept_mentor', 'Imani\'s first three sessions', R,
        'Not a tutorial: a colleague who comments on what you actually do in sessions 1-3, then goes quiet.',
        [('js_modes_story_mentor', X)])
concept('concept_life_beats', 'Life beats (personal decisions)', R,
        'Five personal decisions after the bell, paid from your own money, shown on later payslips and in the ending.',
        [('js_modes_story_life', X), ('js_art_decisions', X)])
concept('concept_risk_desk', 'Risk desk discipline review', R,
        'Breaches (loss limit, leverage, overnight, chasing hype) cut the bonus 15%; a clean week pays x1.25.',
        [('js_trading_broker', I), ('js_modes_story_economy', I)])
concept('concept_anomalies', 'Twelve hidden anomalies', R,
        'Unmarked anomalies in public information; each anomaly morning hides one wrong pixel and they change the final weekend.',
        [('js_modes_story_story_data', I), ('js_art_storyboard', I)])
concept('concept_cinematics', 'Cinematics and storyboard', R,
        'Cached authored 640x360 frames driven by a 61-row beat sheet; every scene is skippable.',
        [('js_art_cinematic', X), ('js_art_storyboard', X), ('js_art_rhythm', X), ('js_art_scenes', X)])
concept('concept_chiptune', 'Adaptive chiptune score', R,
        'WebAudio: two pulse voices, triangle bass, noise channel; layers breathe with stress and the clock.',
        [('js_audio_music', X), ('js_audio_sfx', X)])
concept('concept_fiction_denylist', 'Everything-is-invented denylist test', R,
        'A test fails if any printable string matches a real company, person or event.',
        [('js_market_tickers', X), ('js_tests_tests', X)])
concept('concept_storage_adapter', 'Swappable storage adapter', R,
        'All persistence goes through one adapter so a desktop wrapper (Tauri/Electron) can swap in a filesystem backend.',
        [('js_core_storage', X)])
concept('concept_headless_tests', 'Headless test runners', R,
        'Node runners load the game in index.html order through one shared loader and play bots through whole careers.',
        [('js_tests_harness', X), ('js_tests_node_run', X), ('js_tests_sim_run', X), ('js_tests_balance_run', X),
         ('js_tests_economy_run', X), ('js_tests_reachability_run', X), ('js_tests_render_run', X), ('js_tests_browser_run', X)])

concept('concept_locked_palette', 'Locked 32-colour palette', A,
        'One palette shared by CSS and canvas art keeps the whole game looking like one machine drew it.',
        [('js_art_palette', X), ('css_tokens', X), ('js_art_pixel', X)])
concept('concept_faded_power', 'Faded Power (visual thesis)', A,
        'Present-day story in timeless pixel art; colour washed out, bright colour reserved for information and consequence.',
        [('concept_locked_palette', I)])
concept('concept_cascade_symbol', 'CASCADE stack symbol', A,
        'The central symbol: a stacked-note mark that starts aligned, slips, and eventually falls as stability drops.',
        [('js_art_story_art', I), ('js_main', I), ('js_art_rhythm', I)])
concept('concept_act_progression', 'Four-act visual progression', A,
        'Melt-Up (amber) -> Tremors (violet) -> Contagion (cold blue) -> Reckoning (bruised red).',
        [('js_art_storyboard', X), ('js_modes_story_story_data', X)])
concept('concept_portraits', 'Procedural pixel portraits', A,
        'Seven principal characters drawn procedurally on a 48x48 grid inside the locked palette.',
        [('js_art_portraits', X)])
concept('concept_desk_residue', 'Story residue on the desk', A,
        'Choices and regulatory heat leave persistent objects on the player\'s desk.',
        [('js_art_story_art', X)])
concept('concept_pixel_fonts', 'Three pixel fonts', A,
        'Silkscreen for display and controls, Tiny5 for interface and story, VT323 for financial data.',
        [('css_fonts', X), ('css_fonts_silkscreen', X), ('css_fonts_tiny5', X), ('css_fonts_vt323', X)])

# the two docs point at each other's subjects
edges.append({'source': 'concept_faded_power', 'target': 'concept_act_progression', 'relation': 'conceptually_related_to',
              'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': A, 'weight': 1.0})
edges.append({'source': 'concept_cascade_symbol', 'target': 'concept_career_mode', 'relation': 'conceptually_related_to',
              'confidence': 'INFERRED', 'confidence_score': 0.85, 'source_file': A, 'weight': 1.0})
edges.append({'source': 'concept_deterministic_replay', 'target': 'concept_storage_adapter', 'relation': 'conceptually_related_to',
              'confidence': 'EXTRACTED', 'confidence_score': 1.0, 'source_file': R, 'weight': 1.0})

json.dump({'nodes': nodes, 'edges': edges, 'hyperedges': [], 'input_tokens': 0, 'output_tokens': 0},
          open(sys.argv[1], 'w'), indent=1)
print(len(nodes), 'doc nodes,', len(edges), 'doc edges')
