import base64, html, json, os
import sfx_catalog as C

def b64(path):
    return base64.b64encode(open(path, "rb").read()).decode()

def motif(steps, xs=None, flat_idx=None, w=150, h=44):
    lo, hi = -4, 4
    pad = 8
    xs = xs or [pad + i * (w - 2 * pad) / max(len(steps) - 1, 1) for i in range(len(steps))]
    def y(s): return h - pad - (s - lo) / (hi - lo) * (h - 2 * pad)
    lines = "".join(f'<line x1="0" x2="{w}" y1="{y(v):.1f}" y2="{y(v):.1f}" class="ml"/>' for v in (-2, 0, 2))
    dots = ""
    for i, s in enumerate(steps):
        yy = y(s) + (3 if flat_idx == i else 0)
        dots += f'<circle cx="{xs[i]:.1f}" cy="{yy:.1f}" r="3.6" class="md"/>'
        if flat_idx == i:
            dots += f'<text x="{xs[i]+6:.1f}" y="{yy-3:.1f}" class="mf">b</text>'
    return f'<svg viewBox="0 0 {w} {h}" width="{w}" height="{h}" aria-hidden="true">{lines}{dots}</svg>'

T = [-3, 0, 2, 1, 0]
tracks = {
 "menu": dict(src="out/menu_opening_bell.mp3", title="Opening Bell", sub="Main menu, loops every 1:31", motif=motif(T),
    cues=["0:00 The opening bell strikes, low and high together.",
          "0:23 Heartbeat pulse, glassy arpeggio and the tune arrive.",
          "0:46 Fullest point: the tune doubles an octave up and a clock ticks.",
          "1:09 Everything drops away and bells play the tune at half speed, then a riser leads back to the first strike."]),
 "arc": dict(src="out/feed_arc.mp3", title="All four acts in one minute", sub="Excerpts joined together, 0:56", motif=None,
    cues=["Hear the daily-feed music darken across the story: bright, then uneasy, then looping, then bare."]),
 "a1": dict(src="out/feed_act1_melt_up.mp3", title="Act I, Melt-Up", sub="Daily feed, loops every 0:49", motif=motif(T),
    cues=["A soft piano, a slow bass and a train rolling underneath, like reading on a commute.",
          "0:12 The tune appears for the first time.", "0:25 The tune walks across all four chords."]),
 "a2": dict(src="out/feed_act2_tremors.mp3", title="Act II, Tremors", sub="Daily feed, loops every 0:49", motif=motif(T, flat_idx=2),
    cues=["Same tune, same chord shape, but in the minor key. The third note drops a half step.",
          "0:11, 0:24, 0:36, 0:48 Faint distant rumbles.", "A low drone sits under everything."]),
 "a2n": dict(src="out/feed_act2_anomaly12.mp3", title="Act II with 12 anomalies found", sub="Same track, anomaly counter at 12", motif=None,
    cues=["Compare with Act II. A thin, slightly sharp echo of the melody trails just behind it.",
          "In the game this fades in as the anomaly counter rises. It never explains itself."]),
 "a3": dict(src="out/feed_act3_contagion.mp3", title="Act III, Contagion", sub="Daily feed, loops every 0:46", motif=motif(T[:2], xs=[40, 110]),
    cues=["Two copies of the same piano pattern, left and right. One runs slightly slower.",
          "They start together, drift apart until about 0:23, then slide back together exactly at the loop point.",
          "The tune shrinks to its first two notes, a bell every four bars."]),
 "a4": dict(src="out/feed_act4_reckoning.mp3", title="Act IV, Reckoning", sub="Daily feed, loops every 1:04", motif=motif([3, 0, -2, -1, 0]),
    cues=["Almost nothing left. Slow piano, a drone and one bell.",
          "The bell tolls the tune upside down and stretched to four times its length: 0:00, 0:16, 0:32, 0:48, 1:00.",
          "The train is nearly gone."]),
}
game = {
 "g1": dict(src="out/page/game_session_act1.mp3", title="A full trading day, Act I (3:00)", sub="Music plus sound effects plus tension changes",
    motif=motif(T),
    cues=["0:00 Opening bell. The day starts calm: pad, bass, ticker tape and a soft pulse.",
          "0:07 First buy. Orders, wins and losses have their own sounds throughout.",
          "0:48 A big news alert. The music jumps to full tension: glass arpeggio first, then the tune on the lead.",
          "1:10 A message from Kroll and the heat meter rises. 1:18 a decision card appears; the ticks are its timer.",
          "1:30 to 2:00 Midday lull. The music thins back out on its own.",
          "2:28 Quota reached.",
          "2:50 The last ten seconds tick. 2:52 the closing riser starts. 3:00 closing bell and the music fades."]),
 "g2": dict(src="out/page/game_ramp_act2.mp3", title="Act II, Tremors (1:15 tension ramp)", sub="Music only: calm to full tension and back",
    motif=motif(T, flat_idx=2),
    cues=["Starts calm with pad, bass and ticker tape. The heartbeat comes in around 0:11 and piano stabs ease in.",
          "Around 0:20 to 0:33 the glass arpeggio joins. From about 0:33 the lead plays the tune.",
          "Full drive near 1:00, then it relaxes.",
          "Harmony bends toward the minor: Em7 flat 5 leans into A7 flat 9. A low drone and distant rumbles sit underneath."]),
 "g3": dict(src="out/page/game_ramp_act3.mp3", title="Act III, Contagion (1:15 tension ramp)", sub="Music only",
    motif=motif(T[:2], xs=[40, 110]),
    cues=["A steady pulse on one low D. The ground never moves.",
          "One copy of a small pattern plays from the start. A second joins near 0:18, a third near 0:30, a fourth near 0:42.",
          "Each copy runs at a slightly different speed, so they drift apart like four funds running the same model. They all realign at the loop point."]),
 "g4": dict(src="out/page/game_ramp_act4.mp3", title="Act IV, Reckoning (1:30 tension ramp)", sub="Music only",
    motif=motif([3, 0, -2, -1, 0]),
    cues=["Half-tempo, sparse. It answers to tension but never gets loud.",
          "A bell tolls the tune upside down and very slowly.",
          "Hear how little changes between calm and full tension. That is on purpose."]),
 "g5": dict(src="out/page/game_act2_ghost12.mp3", title="Act II at full tension with 12 anomalies", sub="The ghost echo on the lead melody",
    motif=None,
    cues=["Same rule as the feed: a thin, sharp, slightly late copy of the melody, panned to the other side."]),
}

sfx_groups = [
 ("Buying and selling", ["order_buy", "order_sell", "order_short", "order_cover", "order_limit_set", "order_limit_fill", "order_reject", "order_cancel", "win_close", "loss_close"]),
 ("Buttons and screens", ["ui_click", "ui_tab", "ui_back", "screen_in", "screen_out"]),
 ("The clock", ["bell_open", "bell_close", "close_riser", "countdown_tick", "countdown_final"]),
 ("Decisions", ["decision_prompt", "decision_tick", "decision_timeout", "decision_confirm"]),
 ("The Sqwak phone", ["phone_open", "sqwak_post", "sqwak_push", "sqwak_alert_wire", "sqwak_resqwak", "sqwak_paywall", "feed_skip", "mail_new", "dm_imani", "dm_kroll", "dm_compliance", "anomaly_logged"]),
 ("Story meters", ["quota_met", "week_made", "quota_missed", "strike_added", "heat_up"]),
 ("Big moments", ["flash_crash", "halt", "hope_chime", "cutscene_hit", "cutscene_whoosh"]),
 ("Endings", ["ending_fired", "ending_wiped", "ending_hollow_win", "ending_unpriced"]),
]
def nice(i): return i.replace("_", " ")

def card(t):
    cues = "".join(f"<li>{html.escape(c)}</li>" for c in t["cues"])
    m = f'<div class="motif">{t["motif"]}</div>' if t["motif"] else ""
    return f'''<section class="track">
  <div class="head"><div><h3>{html.escape(t["title"])}</h3><p class="sub">{html.escape(t["sub"])}</p></div>{m}</div>
  <audio controls preload="metadata" src="data:audio/mpeg;base64,{b64(t["src"])}"></audio>
  <ul>{cues}</ul>
</section>'''

rows = '<h2 id="menu">Menu</h2>' + card(tracks["menu"])
rows += '<h2 id="feed">Daily feed</h2>' + "".join(card(tracks[k]) for k in ("arc", "a1", "a2", "a2n", "a3", "a4"))
rows += '<h2 id="game">Gameplay: Market Hours</h2><p class="lede2">New. The music reacts to how tense the market is. Calm markets keep it low and ticking. Tense ones bring in the arpeggio, then the tune. These are demos with the tension changed on a schedule.</p>'
rows += "".join(card(game[k]) for k in ("g1", "g2", "g3", "g4", "g5"))

data = {}
def add_clip(key, stem):
    data[key] = "data:audio/mpeg;base64," + b64(f"out/page/sfx_{stem}.mp3")

sfx_html = '<h2 id="sfx">Sound effects</h2><p class="lede2">New. Tap any sound. They are tuned to the same key as the music, and reward sounds start with the first two notes of the game\'s tune. Long ones are cut at 6 seconds here.</p>'
pack = json.load(open("events/sfx_pack.json"))["sounds"]
for title, ids in sfx_groups:
    sfx_html += f'<h3 class="g">{html.escape(title)}</h3><ul class="sfxlist">'
    for sid in ids:
        spec = pack[sid]
        add_clip(sid, sid)
        extra = ""
        if sid == "anomaly_logged":
            for n in (1, 6, 12):
                add_clip(f"anomaly_logged_n{n}", f"anomaly_logged_n{n}")
            extra = '<span class="alt">Count: ' + "".join(f'<button class="sfx small" data-id="anomaly_logged_n{n}">{n}</button>' for n in (1, 6, 12)) + '</span>'
            btn = ""
        else:
            btn = f'<button class="sfx" data-id="{sid}">{html.escape(nice(sid))}</button>'
        if sid == "anomaly_logged":
            btn = f'<span class="name">{html.escape(nice(sid))}</span>'
        sfx_html += f'<li>{btn}{extra}<span class="d">{html.escape(spec["desc"])}</span><span class="w">Plays when: {html.escape(spec["when"])}</span></li>'
    sfx_html += '</ul>'
sfx_html += '<h3 class="g">Dialogue blips</h3><p class="lede2">One tiny blip per letter, each speaker with their own pitch. Only useful if the game prints dialogue one letter at a time.</p><ul class="sfxlist">'
for who in ("imani", "kroll", "sana", "thorne", "compliance", "narrator"):
    add_clip(f"text_demo_{who}", f"text_demo_{who}")
    sfx_html += f'<li><button class="sfx" data-id="text_demo_{who}">{who}</button><span class="d">{html.escape(C.S["text_blip_" + who]["desc"].split(" Only")[0])}</span></li>'
sfx_html += '</ul>'

page = f'''<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Bell to Bell: music and sound previews</title>
<meta name="color-scheme" content="light dark">
<style>
:root{{--bg:#e8ecf1;--ink:#1a2130;--mute:#4d586b;--line:#c5ccd8;--brass:#8a5c0f;--panel:#f3f5f8;--btn:#fff;
  box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}
@media (prefers-color-scheme: dark){{:root:not([data-theme="light"]){{--bg:#182131;--ink:#e6e9ee;--mute:#a3adbd;--line:#2d3a50;--brass:#d6a545;--panel:#1f2b3f;--btn:#27354d}}}}
:root[data-theme="dark"]{{--bg:#182131;--ink:#e6e9ee;--mute:#a3adbd;--line:#2d3a50;--brass:#d6a545;--panel:#1f2b3f;--btn:#27354d}}
*{{box-sizing:border-box}}
html{{height:auto;scroll-padding-top:env(safe-area-inset-top,0px)}}
body{{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}}
main{{max-width:640px;margin:0 auto;padding:28px 18px 60px}}
h1{{font:600 28px/1.15 Georgia,"Iowan Old Style",Palatino,serif;margin:0 0 10px;letter-spacing:-.01em}}
.lede{{color:var(--mute);margin:0 0 14px;max-width:52ch}} .lede2{{color:var(--mute);margin:-4px 0 14px;max-width:52ch;font-size:15px}}
nav{{display:flex;gap:14px;flex-wrap:wrap;margin:0 0 6px;font-size:15px}} nav a{{color:var(--brass);text-decoration:none;border-bottom:1px solid var(--line)}} nav a:focus-visible,button:focus-visible{{outline:2px solid var(--brass);outline-offset:2px}}
h2{{font:600 20px/1.2 Georgia,"Iowan Old Style",Palatino,serif;margin:34px 0 12px;padding-bottom:8px;border-bottom:1px solid var(--line)}}
h3.g{{font-size:15px;font-weight:650;margin:22px 0 6px;color:var(--ink)}}
.track{{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px 16px 12px;margin:0 0 14px}}
.head{{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}}
h3{{margin:0;font-size:17px;font-weight:650}} .sub{{margin:2px 0 0;color:var(--mute);font-size:14px}}
.motif svg{{display:block}} .ml{{stroke:var(--line);stroke-width:1}} .md{{fill:var(--brass)}} .mf{{fill:var(--brass);font:700 11px Georgia,serif}}
audio{{width:100%;margin:12px 0 6px;height:40px}}
ul{{margin:6px 0 0;padding-left:18px}} li{{margin:5px 0;font-size:15px}}
.sfxlist{{list-style:none;padding:0;margin:0}} .sfxlist li{{display:grid;grid-template-columns:1fr;gap:2px;padding:10px 0;border-bottom:1px solid var(--line)}}
button.sfx{{justify-self:start;background:var(--btn);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:8px 14px;font:600 15px system-ui,sans-serif;cursor:pointer;min-height:40px}}
button.sfx.small{{padding:6px 12px;min-height:36px;margin-left:6px}} button.sfx.on{{border-color:var(--brass)}}
.name{{font-weight:650}} .alt{{display:block;margin:2px 0}} .d{{font-size:15px}} .w{{font-size:13px;color:var(--mute)}}
.foot{{color:var(--mute);font-size:14px;margin-top:30px;max-width:52ch}}
@media (max-width:420px){{.motif{{display:none}}}}
</style></head><body><main>
<h1>Bell to Bell: music and sound previews</h1>
<p class="lede">Menu, daily feed, gameplay and sound effects. Loops play once and then the first ten seconds again so you can hear the wrap-around. The dots show the five-note tune that ties everything together and how it changes.</p>
<nav><a href="#menu">Menu</a><a href="#feed">Daily feed</a><a href="#game">Gameplay</a><a href="#sfx">Sound effects</a></nav>
{rows}
{sfx_html}
<p class="foot">Previews are rendered from the same scores and sound recipes the game would play. Gameplay and sound-effect previews use lighter audio quality here than in the kit. Nothing has been run inside the game yet.</p>
</main>
<script type="application/json" id="clips">{json.dumps(data)}</script>
<script>
(function(){{
  var clips = JSON.parse(document.getElementById('clips').textContent), cur = null, curBtn = null;
  document.addEventListener('click', function(e){{
    var b = e.target.closest('button.sfx'); if(!b) return;
    var uri = clips[b.getAttribute('data-id')]; if(!uri) return;
    if(cur){{ cur.pause(); if(curBtn) curBtn.classList.remove('on'); }}
    cur = new Audio(uri); curBtn = b; b.classList.add('on');
    cur.addEventListener('ended', function(){{ b.classList.remove('on'); }});
    cur.play();
  }});
}})();
</script></body></html>'''
open("/mnt/user-data/outputs/bell-to-bell-music-previews.html", "w").write(page)
print(round(os.path.getsize("/mnt/user-data/outputs/bell-to-bell-music-previews.html") / 1e6, 2), "MB")
