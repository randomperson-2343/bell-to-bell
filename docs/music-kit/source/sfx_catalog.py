"""
sfx_catalog.py - every sound effect in the Bell to Bell pack, as plain data.
Pitched sounds live in D minor pentatonic (D F G A C) so they never fight the music, which is in D minor (menu, gameplay)
or F (feed, the relative key).

Reward sounds start with the first two notes of the game's tune T (A4 -> D5). Penalty sounds play the same interval
backwards (D5 -> A4). The only place the foreign note F sharp appears is the D57 hope chime.
"""

# category -> target peak in dBFS of the final, normalised file
PEAK_DB = {"ui": -16, "order": -12, "sqwak": -13, "reward": -9, "negative": -9, "story": -8, "event": -5,
           "text": -22, "clock": -15, "decision": -10, "cutscene": -7, "ending": -6}

S = {}


def add(id, cat, desc, when, voices, rev=0.0, duck=0.0, cooldown=0.0, max_voices=2, room=1.4, n_param=None):
    S[id] = dict(cat=cat, desc=desc, when=when, rev=rev, duck=duck, cooldown=cooldown, maxVoices=max_voices,
                 room=room, voices=voices)
    if n_param:
        S[id]["nParam"] = n_param


def tone(t, d, n=None, f=None, v=0.6, wave="sine", **kw):
    o = dict(type="tone", t=t, d=d, v=v, wave=wave)
    if n is not None:
        o["n"] = n
    if f is not None:
        o["f"] = f
    o.update(kw)
    return o


def noise_v(t, d, filter="bp", f0=1000, v=0.3, **kw):
    o = dict(type="noise", t=t, d=d, filter=filter, f0=f0, v=v)
    o.update(kw)
    return o


def inst(t, name, n=0, v=0.8, d=1.0, **kw):
    o = dict(type="inst", t=t, inst=name, n=n, v=v, d=d)
    o.update(kw)
    return o


FM = lambda ratio=2.0, idx=1.2, itc=0.05: dict(ratio=ratio, idx=idx, itc=itc)

# ------------------------------------------------------------------------------------------ UI
add("ui_click", "ui", "Glass tap for any button.", "Every generic button press.",
    [tone(0, 0.03, f=1900, f_end=1100, gtc=0.012, v=0.6, dtc=0.018, a=0.001),
     noise_v(0, 0.012, "hp", 5000, v=0.25, dtc=0.004)], cooldown=0.03, max_voices=3)
add("ui_tab", "ui", "Softer pluck for switching tabs (Home, Explore, Alerts, DMs, Me).", "Tab change on the phone or terminal.",
    [tone(0, 0.05, n=79, wave="triangle", v=0.5, dtc=0.04, lp=dict(f0=4000, f1=1500, tc=0.05)),
     noise_v(0, 0.01, "hp", 6000, v=0.15, dtc=0.004)], cooldown=0.04)
add("ui_back", "ui", "Falling tap for back, close or cancel.", "Back, close, dismiss.",
    [tone(0, 0.06, f=1300, f_end=650, gtc=0.05, v=0.5, dtc=0.04)], cooldown=0.04)
add("screen_in", "ui", "Soft rising air for a panel or screen opening.", "A screen, panel or card slides in.",
    [noise_v(0, 0.22, "bp", 400, f1=2600, stc=0.12, q=0.9, v=0.35, a=0.08, dtc=0.12)], rev=0.08, cooldown=0.1, max_voices=1)
add("screen_out", "ui", "Soft falling air for a panel or screen closing.", "A screen, panel or card closes.",
    [noise_v(0, 0.2, "bp", 2600, f1=350, stc=0.1, q=0.8, v=0.35, a=0.01, dtc=0.1)], cooldown=0.1, max_voices=1)

# ---------------------------------------------------------------------------------------- ORDERS
add("order_buy", "order", "Two quick glassy notes rising a fourth (A4 to D5).", "A buy order fills.",
    [tone(0, 0.07, n=69, v=0.6, dtc=0.05, fm=FM(2, 1.2, 0.05)),
     tone(0.075, 0.12, n=74, v=0.7, dtc=0.09, fm=FM(2, 1.2, 0.05)),
     noise_v(0, 0.01, "hp", 4500, v=0.15, dtc=0.004)], rev=0.12, cooldown=0.06, max_voices=3)
add("order_sell", "order", "The same two notes falling (D5 to A4), a little darker.", "A sell order fills.",
    [tone(0, 0.07, n=74, v=0.6, dtc=0.05, fm=FM(2, 0.8, 0.05), lp=dict(f0=3500, f1=3500)),
     tone(0.075, 0.12, n=69, v=0.7, dtc=0.09, fm=FM(2, 0.8, 0.05), lp=dict(f0=3500, f1=3500)),
     noise_v(0, 0.01, "hp", 4500, v=0.15, dtc=0.004)], rev=0.12, cooldown=0.06, max_voices=3)
add("order_short", "order", "Three falling notes (D5, A4, F4) with a soft thump.", "A short sale opens.",
    [tone(0, 0.07, n=74, v=0.6, wave="triangle", dtc=0.05, fm=FM(2, 0.9, 0.05)),
     tone(0.07, 0.07, n=69, v=0.6, wave="triangle", dtc=0.05, fm=FM(2, 0.9, 0.05)),
     tone(0.14, 0.12, n=65, v=0.7, wave="triangle", dtc=0.09, fm=FM(2, 0.9, 0.05)),
     tone(0, 0.08, f=110, f_end=70, gtc=0.03, v=0.4, dtc=0.05)], rev=0.12, cooldown=0.06, max_voices=3)
add("order_cover", "order", "Three rising notes (F4, A4, D5).", "A short position is covered.",
    [tone(0, 0.07, n=65, v=0.6, wave="triangle", dtc=0.05, fm=FM(2, 0.9, 0.05)),
     tone(0.07, 0.07, n=69, v=0.6, wave="triangle", dtc=0.05, fm=FM(2, 0.9, 0.05)),
     tone(0.14, 0.12, n=74, v=0.7, wave="triangle", dtc=0.09, fm=FM(2, 0.9, 0.05))], rev=0.12, cooldown=0.06, max_voices=3)
add("order_limit_set", "order", "Tap, tap: an order is resting.", "A limit or stop order is placed but not filled.",
    [tone(0, 0.05, n=74, v=0.5, dtc=0.04, fm=FM(2, 0.8, 0.04)),
     tone(0.12, 0.05, n=74, v=0.25, dtc=0.04, fm=FM(2, 0.8, 0.04))], rev=0.1, cooldown=0.06)
add("order_limit_fill", "order", "A small bright bell ding (D6 over D5).", "A resting limit or stop order fills.",
    [inst(0, "bell", 86, 0.6, tc=0.45), inst(0.03, "bell", 74, 0.5, tc=0.6),
     noise_v(0, 0.01, "hp", 5000, v=0.15, dtc=0.004)], rev=0.3, cooldown=0.08, max_voices=2)
add("order_reject", "order", "Two dry low buzzes a tritone apart. Nothing happened.", "An order is refused (no cash, halted, not allowed).",
    [tone(0, 0.1, n=45, wave="square", v=0.5, lp=dict(f0=2600, f1=2600), sat=1.8, dtc=0.05, s=0.8, rtc=0.02),
     tone(0, 0.1, n=51, wave="square", v=0.4, lp=dict(f0=2600, f1=2600), sat=1.8, dtc=0.05, s=0.8, rtc=0.02),
     noise_v(0, 0.08, "bp", 1800, v=0.25, q=1.2, dtc=0.04, s=0.5),
     tone(0.14, 0.1, n=45, wave="square", v=0.5, lp=dict(f0=2600, f1=2600), sat=1.8, dtc=0.05, s=0.8, rtc=0.02),
     tone(0.14, 0.1, n=51, wave="square", v=0.4, lp=dict(f0=2600, f1=2600), sat=1.8, dtc=0.05, s=0.8, rtc=0.02),
     noise_v(0.14, 0.08, "bp", 1800, v=0.25, q=1.2, dtc=0.04, s=0.5)], cooldown=0.1, max_voices=1)
add("order_cancel", "order", "A small falling blip with a puff of air.", "A resting order is cancelled.",
    [tone(0, 0.05, f=900, f_end=500, gtc=0.04, v=0.5, dtc=0.04),
     noise_v(0, 0.05, "lp", 2500, v=0.15, dtc=0.03)], cooldown=0.06)

# ------------------------------------------------------------------------------------------ P&L
add("win_close", "reward", "Rising D minor arpeggio (D5 F5 A5) ending on a tiny bell.", "A position closes in profit.",
    [tone(0, 0.07, n=74, v=0.55, dtc=0.06, fm=FM(2, 1.0, 0.06)),
     tone(0.07, 0.07, n=77, v=0.55, dtc=0.06, fm=FM(2, 1.0, 0.06)),
     tone(0.14, 0.09, n=81, v=0.6, dtc=0.08, fm=FM(2, 1.0, 0.06)),
     inst(0.21, "bell", 86, 0.45, tc=0.5)], rev=0.25, cooldown=0.15, max_voices=2)
add("loss_close", "negative", "Falling steps (D5, C5, A4) ending on a low thump. Muted.", "A position closes at a loss.",
    [tone(0, 0.09, n=74, wave="triangle", v=0.5, dtc=0.07, lp=dict(f0=1200, f1=1200)),
     tone(0.09, 0.09, n=72, wave="triangle", v=0.5, dtc=0.07, lp=dict(f0=1200, f1=1200)),
     tone(0.18, 0.14, n=69, wave="triangle", v=0.55, dtc=0.1, lp=dict(f0=1200, f1=1200)),
     tone(0.18, 0.12, f=90, f_end=60, gtc=0.05, v=0.5, dtc=0.08)], rev=0.1, cooldown=0.15, max_voices=2)

# ----------------------------------------------------------------------------------------- CLOCK
add("bell_open", "event", "The menu's opening bell: low D4, D5 and a faint D6. One strike.", "9:30 a.m. market open, start of every trading day.",
    [inst(0, "bell", 62, 1.0, tc=2.2), inst(0, "bell", 74, 0.8, tc=1.5), inst(0, "bell", 86, 0.4, tc=0.9)],
    rev=0.55, duck=4.0, max_voices=1, room=2.2)
add("bell_close", "event", "Closing bell: low D4 and D5, four softer D5 strikes, then one low D3.", "4:00 p.m. market close.",
    [inst(0, "bell", 62, 1.0, tc=2.4), inst(0, "bell", 74, 0.8, tc=1.4)]
    + [inst(0.55 * (i + 1), "bell", 74, v, tc=1.4) for i, v in enumerate((0.7, 0.6, 0.5, 0.4))]
    + [inst(2.75, "bell", 50, 0.8, tc=3.0)],
    rev=0.6, duck=5.0, max_voices=1, room=2.2)
add("countdown_tick", "clock", "A wood tock with a tiny high tick.", "Once a second during the last 10 seconds before the close (except the last 3).",
    [inst(0, "tock", 0, 0.55), tone(0, 0.02, n=86, v=0.18, dtc=0.012)], cooldown=0.2, max_voices=1)
add("countdown_final", "clock", "The same tock with a higher, longer tick.", "Once a second for the last 3 seconds before the close.",
    [inst(0, "tock", 0, 0.65), tone(0, 0.05, n=93, v=0.35, dtc=0.03)], cooldown=0.2, max_voices=1)
add("close_riser", "clock", "Noise sweeps upward while a low saw tone climbs two octaves. It ends where the bell begins.", "Start it 8 seconds before the closing bell.",
    [inst(0, "riser", 0, 0.9, d=8.0),
     tone(0, 8.0, n=50, n_end=74, ramp=True, wave="sawtooth", v=0.3, a=7.5, dtc=50.0, s=1.0, rtc=0.05,
          lp=dict(f0=300, f1=3000, ramp=True))], rev=0.3, max_voices=1)

# -------------------------------------------------------------------------------------- DECISIONS
add("decision_prompt", "decision", "Three bells (D4, A4, G5) swell in under a low sine. Unresolved on purpose.", "A decision card appears (Decisions 1 to 10).",
    [inst(0, "bell", 62, 0.7, tc=1.2), inst(0.02, "bell", 69, 0.6, tc=1.0), inst(0.04, "bell", 79, 0.5, tc=0.9),
     tone(0, 1.0, n=50, v=0.4, a=0.6, dtc=0.6, s=0.5, rtc=0.4)], rev=0.5, duck=3.0, max_voices=1)
add("decision_tick", "decision", "A dull low tock.", "Once a second while a decision timer is under about 8 seconds.",
    [inst(0, "tock", 0, 0.6), tone(0, 0.05, n=50, v=0.3, dtc=0.03)], cooldown=0.3, max_voices=1)
add("decision_timeout", "decision", "Low buzz and kick: you waited too long.", "A decision timer runs out.",
    [tone(0, 0.35, n=38, wave="square", v=0.6, lp=dict(f0=1800, f1=1800), sat=2.0, dtc=0.3),
     tone(0, 0.35, n=50, wave="square", v=0.3, lp=dict(f0=1800, f1=1800), sat=2.0, dtc=0.3),
     inst(0, "kick", 0, 1.0, deep=1.0), noise_v(0, 0.4, "bp", 900, v=0.35, q=0.9, dtc=0.2)], rev=0.15, duck=4.0, max_voices=1)
add("decision_confirm", "decision", "Kick, low bell, tiny click: a choice is locked in.", "The player picks a decision option.",
    [inst(0, "kick", 0, 0.9), inst(0, "bell", 62, 0.6, tc=0.9), tone(0, 0.05, n=74, v=0.3, dtc=0.03)], rev=0.25, max_voices=1)

# ----------------------------------------------------------------------------------------- SQWAK
add("sqwak_push", "sqwak", "Two quick bird-like chirps, the game's name joke.", "A Sqwak push alert interrupts the scroll.",
    [tone(0, 0.07, f=900, f_end=2000, gtc=0.03, v=0.55, dtc=0.05, fm=FM(1.5, 1.0, 0.04)),
     tone(0.1, 0.09, f=1100, f_end=2400, gtc=0.03, v=0.55, dtc=0.06, fm=FM(1.5, 1.0, 0.04)),
     noise_v(0, 0.01, "hp", 6000, v=0.15, dtc=0.004)], rev=0.1, cooldown=0.25, max_voices=1)
add("sqwak_alert_wire", "sqwak", "Four teletype taps, then two A5 bell dings.", "A big Wire event banner (events marked big) slides in.",
    [noise_v(0.04 * i, 0.015, "bp", 2500, v=0.3, q=2.0, dtc=0.006) for i in range(4)]
    + [inst(0.18, "bell", 81, 0.6, tc=0.6), inst(0.48, "bell", 81, 0.5, tc=0.6)],
    rev=0.3, duck=2.0, cooldown=0.5, max_voices=1)
add("sqwak_post", "sqwak", "A tiny pop.", "A new Sqwak post appears in the market-hours feed.",
    [tone(0, 0.03, f=1300, f_end=1800, gtc=0.01, v=0.35, dtc=0.02)], cooldown=0.4, max_voices=1)
add("sqwak_resqwak", "sqwak", "Tap, small chirp, tiny D6 tick. No undo, so it should feel final.", "The player resqwaks a post.",
    [noise_v(0, 0.01, "hp", 5000, v=0.2, dtc=0.004),
     tone(0, 0.05, f=700, f_end=1500, gtc=0.03, v=0.4, dtc=0.04),
     tone(0.07, 0.04, n=86, v=0.2, dtc=0.03)], rev=0.05, cooldown=0.15)
add("sqwak_paywall", "sqwak", "Two dull bonks: you cannot open this.", "The player taps a paywalled headline.",
    [tone(0, 0.1, f=220, f_end=170, gtc=0.08, wave="triangle", v=0.6, dtc=0.06, lp=dict(f0=800, f1=800)),
     tone(0.13, 0.1, f=220, f_end=170, gtc=0.08, wave="triangle", v=0.6, dtc=0.06, lp=dict(f0=800, f1=800))], cooldown=0.3)
add("feed_skip", "sqwak", "A quick falling swish and a soft thud.", "The one-gesture skip out of the pre-open feed.",
    [noise_v(0, 0.2, "bp", 3200, f1=300, stc=0.08, q=0.8, v=0.4, a=0.002, dtc=0.1),
     tone(0.12, 0.06, n=38, v=0.3, dtc=0.04)], rev=0.05, max_voices=1)
add("phone_open", "sqwak", "Three tiny ticks and a rising chirp.", "The pre-open phone appears.",
    [noise_v(0.05 * i, 0.01, "hp", 6000, v=0.2, dtc=0.004) for i in range(3)]
    + [tone(0.12, 0.08, f=600, f_end=1200, gtc=0.05, v=0.3, dtc=0.06)], rev=0.1, max_voices=1)
add("mail_new", "sqwak", "Two bell notes a fifth apart (G5 to D6).", "New firm mail (HLST Mail: Research, Ops, Risk).",
    [inst(0, "bell", 79, 0.5, tc=0.35), inst(0.12, "bell", 86, 0.5, tc=0.5)], rev=0.25, cooldown=0.3, max_voices=1)
add("dm_imani", "sqwak", "Warm: A5 to D6 on a soft FM tone.", "A DM from Imani.",
    [tone(0, 0.09, n=81, v=0.5, dtc=0.07, fm=FM(2, 1.0, 0.06)), tone(0.09, 0.12, n=86, v=0.5, dtc=0.09, fm=FM(2, 1.0, 0.06))],
    rev=0.2, cooldown=0.3, max_voices=1)
add("dm_kroll", "sqwak", "Curt: two low taps and a low bell.", "A DM or email from Kroll.",
    [tone(0, 0.08, n=38, v=0.6, dtc=0.05), tone(0.1, 0.08, n=38, v=0.5, dtc=0.05), inst(0.1, "bell", 50, 0.6, tc=0.5)],
    rev=0.15, cooldown=0.3, max_voices=1)
add("dm_compliance", "sqwak", "Cold: two thin beeps a tritone apart (E5 and B flat 5).", "A Compliance DM (also plays when a post names a ticker).",
    [tone(0, 0.07, n=76, v=0.45, dtc=0.05), tone(0.12, 0.07, n=82, v=0.45, dtc=0.05)], rev=0.05, cooldown=0.3, max_voices=1)
add("anomaly_logged", "story", "A thin D6 ping plus a ghost copy. The ghost gets sharper, later and louder as the anomaly count n grows.",
    "The player opens an anomaly item. Pass n = anomalies logged so far, 1 to 12.",
    [tone(0, 0.15, n=86, v=0.5, dtc=0.15, lp=dict(f0=5000, f1=5000)),
     dict(tone(0, 0.15, n=86, v=0.5, dtc=0.15, lp=dict(f0=2400, f1=2400), p=0.4),
          nScale=dict(cents=3, delayS=0.015, vBase=0.22, vPer=0.045))],
    rev=0.2, cooldown=0.5, max_voices=1, n_param=dict(min=1, max=12, default=6))

# ------------------------------------------------------------------------------------ STORY METERS
add("strike_added", "story", "D5 then A4 on bells (the tune's opening interval played backwards), and a heavy low thud.", "A career strike is added.",
    [inst(0, "bell", 74, 0.9, tc=2.0), inst(0.55, "bell", 69, 0.9, tc=2.5),
     inst(0.55, "kick", 0, 1.0, deep=1.0),
     tone(0.55, 0.4, f=90, f_end=40, gtc=0.1, v=0.8, dtc=0.15)], rev=0.5, duck=5.0, max_voices=1, room=2.2)
add("quota_met", "reward", "A4 then D5 on bells: the first two notes of the game's tune.", "The daily quota is reached.",
    [inst(0, "bell", 69, 0.7, tc=0.5), inst(0.22, "bell", 74, 0.85, tc=1.0),
     tone(0.22, 0.1, n=81, v=0.2, dtc=0.08, fm=FM(2, 1.0, 0.06))], rev=0.4, cooldown=1.0, max_voices=1)
add("week_made", "reward", "The quota notes, then F5, A5, D6 bells and a slow pad swell.", "The weekly quota is made (Friday close).",
    [inst(0, "bell", 69, 0.7, tc=0.5), inst(0.22, "bell", 74, 0.85, tc=1.0),
     inst(0.5, "bell", 77, 0.6, tc=1.2), inst(0.7, "bell", 81, 0.6, tc=1.2), inst(0.9, "bell", 86, 0.6, tc=1.4),
     tone(0.2, 1.4, n=62, wave="sawtooth", v=0.25, a=0.8, dtc=0.6, s=0.6, rtc=0.6, lp=dict(f0=1500, f1=1500))],
    rev=0.55, duck=2.0, max_voices=1, room=2.2)
add("quota_missed", "negative", "D5 then A4 falling, a low sine under the second bell.", "The day or week closes under quota.",
    [inst(0, "bell", 74, 0.7, tc=1.0), inst(0.25, "bell", 69, 0.7, tc=1.4),
     tone(0.25, 0.5, n=38, v=0.4, dtc=0.3)], rev=0.4, max_voices=1)
add("heat_up", "story", "A dark noise swell with a low tone.", "The heat meter rises.",
    [noise_v(0, 0.5, "lp", 600, f1=2500, ramp=True, v=0.35, a=0.4, dtc=0.3, s=0.6),
     tone(0, 0.3, n=38, v=0.3, dtc=0.2)], rev=0.1, cooldown=0.5, max_voices=1)

# ------------------------------------------------------------------------------------------ EVENTS
add("flash_crash", "event", "Two deep kicks, a rumble, and a falling siren that wails.", "Screen shake days: the Loop (D31) and the failed vote (D56).",
    [inst(0, "kick", 0, 1.0, deep=1.0), inst(0.18, "kick", 0, 1.0, deep=1.0), inst(0, "tremor", 0, 0.9, d=3.0),
     tone(0, 2.4, n=81, n_end=57, ramp=True, wave="sawtooth", v=0.55, a=0.02, dtc=30.0, s=1.0, rtc=0.3,
          vib=dict(rate=6.5, cents=250), lp=dict(f0=3500, f1=700, ramp=True)),
     noise_v(0, 2.4, "lp", 600, f1=120, ramp=True, v=0.35, a=0.02, dtc=30.0, s=1.0, rtc=0.3)],
    rev=0.35, duck=6.0, max_voices=1, room=2.2)
add("halt", "event", "Three descending beeps (D6, G5, D5) and a low buzz.", "A stock halts (limit up or down).",
    [tone(0, 0.18, n=86, v=0.5, dtc=0.15), tone(0.22, 0.18, n=79, v=0.5, dtc=0.15), tone(0.44, 0.4, n=74, v=0.5, dtc=0.3),
     tone(0.44, 0.6, n=38, wave="square", v=0.3, lp=dict(f0=500, f1=500), dtc=0.4)], rev=0.2, duck=3.0, cooldown=1.0, max_voices=1)
add("hope_chime", "event", "D major bells (D5, F sharp 5, A5, D6) over a pad. The only major third in the game.", "D57 only: the vote passes.",
    [inst(0.14 * i, "bell", n, 0.55, tc=1.8) for i, n in enumerate((74, 78, 81, 86))]
    + [tone(0, 2.0, n=62, v=0.25, a=0.5, dtc=1.0, s=0.6, rtc=1.0), tone(0, 2.0, n=66, v=0.2, a=0.5, dtc=1.0, s=0.6, rtc=1.0)],
    rev=0.7, duck=2.0, max_voices=1, room=2.2)

# ---------------------------------------------------------------------------------------- ENDINGS
add("ending_fired", "ending", "One D3 bell, then a low sine. Then quiet.", "Ending: Fired.",
    [inst(0, "bell", 50, 1.0, tc=3.5), tone(0, 3.0, n=38, v=0.3, a=0.05, dtc=1.5, s=0.3, rtc=1.0)],
    rev=0.8, duck=6.0, max_voices=1, room=2.2)
add("ending_wiped", "ending", "A saw tone falls from A4 to A1 through a closing filter, then one huge low bell.", "Ending: Wiped Out.",
    [tone(0, 4.0, f=440, f_end=55, ramp=True, wave="sawtooth", v=0.4, a=0.05, dtc=30.0, s=1.0, rtc=0.3,
          lp=dict(f0=3000, f1=200, ramp=True)),
     noise_v(0, 4.0, "lp", 800, f1=100, ramp=True, v=0.3, a=0.05, dtc=30.0, s=1.0, rtc=0.3),
     inst(4.0, "kick", 0, 1.0, deep=1.0), inst(4.0, "bell", 38, 0.8, tc=3.0)],
    rev=0.6, duck=6.0, max_voices=1, room=2.2)
add("ending_hollow_win", "ending", "D major bells, then the third drops to F and the chord turns minor. Reads as a win, feels like a loss.", "The win that costs you (Ending 22 and similar).",
    [inst(0, "bell", 74, 0.7, tc=2.5), inst(0, "bell", 78, 0.6, tc=2.5), inst(0, "bell", 81, 0.6, tc=2.5),
     inst(1.8, "bell", 77, 0.7, tc=3.0), inst(1.8, "bell", 74, 0.5, tc=3.0),
     tone(0, 6.0, n=38, v=0.3, a=1.0, dtc=3.0, s=0.5, rtc=2.0)], rev=0.7, duck=3.0, max_voices=1, room=2.2)
add("ending_unpriced", "ending", "Twelve glassy pings, each one sharper than the last, like the anomaly ghost piling up.", "The rogue AI ending: the payout will not price.",
    [tone(0.18 * i, 0.12, n=86, v=0.35, dtc=0.12, detune=6 * i, lp=dict(f0=4000, f1=4000)) for i in range(12)]
    + [noise_v(2.3, 0.3, "hp", 4000, v=0.3, dtc=0.15)], rev=0.6, duck=3.0, max_voices=1, room=2.2)

# --------------------------------------------------------------------------------------- CUTSCENES
add("cutscene_hit", "cutscene", "A kick, a low bell and a falling noise burst.", "Hard cut or impact in a cinematic.",
    [inst(0, "kick", 0, 1.0, deep=1.0), inst(0, "bell", 38, 0.5, tc=1.2),
     noise_v(0, 0.35, "lp", 2000, f1=200, stc=0.1, v=0.5, dtc=0.15)], rev=0.3, duck=3.0, max_voices=1)
add("cutscene_whoosh", "cutscene", "A slow rising swish of air.", "Camera moves and transitions in a cinematic.",
    [noise_v(0, 0.8, "bp", 300, f1=3000, ramp=True, q=0.9, v=0.4, a=0.5, dtc=30.0, s=1.0, rtc=0.2)], rev=0.15, max_voices=1)

# ---------------------------------------------------------------------------------- TEXT BLIPS
# One tiny blip per character. The engine picks pitch = base + [0,3,5,7,10][charCode % 5] semitones (D minor pentatonic
# stays consonant whatever letters come up) and skips spaces and punctuation.
BLIP_STEPS = [0, 3, 5, 7, 10]
for who, n0, wave, lpf, desc in (
        ("imani", 74, "triangle", None, "Imani: warm, mid."),
        ("kroll", 57, "square", 1200, "Kroll: low, blunt."),
        ("sana", 81, "sine", None, "Sana: light, bright."),
        ("thorne", 50, "triangle", 900, "Thorne: gravel, low."),
        ("compliance", 72, "sine", None, "Compliance: flat, even."),
        ("narrator", 69, "sine", None, "Everyone else.")):
    kw = {}
    if lpf:
        kw["lp"] = dict(f0=lpf, f1=lpf)
    add(f"text_blip_{who}", "text", f"{desc} Only if the game prints dialogue one letter at a time.", "One per printed character (see charVariation).",
        [tone(0, 0.025, n=n0, wave=wave, v=0.5, dtc=0.02, rtc=0.012, **kw)], cooldown=0.03, max_voices=2)
    S[f"text_blip_{who}"]["charVariation"] = dict(baseMidi=n0, semitones=BLIP_STEPS, key="charCode % 5")
