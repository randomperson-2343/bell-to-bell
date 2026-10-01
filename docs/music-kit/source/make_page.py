import base64, html

def b64(path):
    return base64.b64encode(open(path, "rb").read()).decode()

def motif(steps, xs=None, flat_idx=None, w=150, h=44):
    # steps are scale steps (higher = higher pitch). Draw five dots on three faint lines.
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
 "menu": dict(file="menu_opening_bell", title="Opening Bell", sub="Main menu, loops every 1:31",
    motif=motif(T),
    cues=["0:00 The opening bell strikes, low and high together.",
          "0:23 Heartbeat pulse, glassy arpeggio and the tune arrive.",
          "0:46 Fullest point: the tune doubles an octave up and a clock ticks.",
          "1:09 Everything drops away and bells play the tune at half speed, then a riser leads back to the first strike."]),
 "arc": dict(file="feed_arc", title="All four acts in one minute", sub="Excerpts joined together, 0:56",
    motif=None,
    cues=["Hear the daily-feed music darken across the story: bright, then uneasy, then looping, then bare."]),
 "a1": dict(file="feed_act1_melt_up", title="Act I, Melt-Up", sub="Daily feed, loops every 0:49",
    motif=motif(T),
    cues=["A soft piano, a slow bass and a train rolling underneath, like reading on a commute.",
          "0:12 The tune appears for the first time.",
          "0:25 The tune walks across all four chords."]),
 "a2": dict(file="feed_act2_tremors", title="Act II, Tremors", sub="Daily feed, loops every 0:49",
    motif=motif(T, flat_idx=2),
    cues=["Same tune, same chord shape, but in the minor key. The third note drops a half step.",
          "0:11, 0:24, 0:36, 0:48 Faint distant rumbles.",
          "A low drone sits under everything."]),
 "a2n": dict(file="feed_act2_anomaly12", title="Act II with 12 anomalies found", sub="Same track, anomaly counter at 12",
    motif=None,
    cues=["Compare with Act II. A thin, slightly sharp echo of the melody trails 0.18 seconds behind it.",
          "In the game this fades in as the anomaly counter rises. It never explains itself."]),
 "a3": dict(file="feed_act3_contagion", title="Act III, Contagion", sub="Daily feed, loops every 0:46",
    motif=motif(T[:2] * 1, xs=[40, 110]),
    cues=["Two copies of the same piano pattern, left and right. One runs slightly slower.",
          "They start together, drift apart until about 0:23, then slide back together exactly at the loop point.",
          "The tune shrinks to its first two notes, a bell every four bars."]),
 "a4": dict(file="feed_act4_reckoning", title="Act IV, Reckoning", sub="Daily feed, loops every 1:04",
    motif=motif([3, 0, -2, -1, 0]),
    cues=["Almost nothing left. Slow piano, a drone and one bell.",
          "The bell tolls the tune upside down and stretched to four times its length: 0:00, 0:16, 0:32, 0:48, 1:00.",
          "The train is nearly gone."]),
}
order = [("Menu", ["menu"]), ("Daily feed", ["arc", "a1", "a2", "a2n", "a3", "a4"])]

rows = ""
for heading, keys in order:
    rows += f'<h2>{heading}</h2>'
    for k in keys:
        t = tracks[k]
        cues = "".join(f"<li>{html.escape(c)}</li>" for c in t["cues"])
        m = f'<div class="motif">{t["motif"]}</div>' if t["motif"] else ""
        rows += f'''<section class="track">
  <div class="head"><div><h3>{html.escape(t["title"])}</h3><p class="sub">{html.escape(t["sub"])}</p></div>{m}</div>
  <audio controls preload="metadata" src="data:audio/mpeg;base64,{b64("out/" + t["file"] + ".mp3")}"></audio>
  <ul>{cues}</ul>
</section>'''

page = f'''<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Bell to Bell: music previews</title>
<meta name="color-scheme" content="light dark">
<style>
:root{{--bg:#e8ecf1;--ink:#1a2130;--mute:#4d586b;--line:#c5ccd8;--brass:#8a5c0f;--panel:#f3f5f8;
  box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}
@media (prefers-color-scheme: dark){{:root:not([data-theme="light"]){{--bg:#182131;--ink:#e6e9ee;--mute:#a3adbd;--line:#2d3a50;--brass:#d6a545;--panel:#1f2b3f}}}}
:root[data-theme="dark"]{{--bg:#182131;--ink:#e6e9ee;--mute:#a3adbd;--line:#2d3a50;--brass:#d6a545;--panel:#1f2b3f}}
*{{box-sizing:border-box}}
html{{height:auto}}
body{{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}}
main{{max-width:640px;margin:0 auto;padding:28px 18px 60px}}
h1{{font:600 28px/1.15 Georgia,"Iowan Old Style",Palatino,serif;margin:0 0 10px;letter-spacing:-.01em}}
.lede{{color:var(--mute);margin:0 0 26px;max-width:52ch}}
h2{{font:600 20px/1.2 Georgia,"Iowan Old Style",Palatino,serif;margin:34px 0 12px;padding-bottom:8px;border-bottom:1px solid var(--line)}}
.track{{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px 16px 12px;margin:0 0 14px}}
.head{{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}}
h3{{margin:0;font-size:17px;font-weight:650}}
.sub{{margin:2px 0 0;color:var(--mute);font-size:14px}}
.motif svg{{display:block}} .ml{{stroke:var(--line);stroke-width:1}} .md{{fill:var(--brass)}} .mf{{fill:var(--brass);font:700 11px Georgia,serif}}
audio{{width:100%;margin:12px 0 6px;height:40px}}
ul{{margin:6px 0 0;padding-left:18px;color:var(--ink)}} li{{margin:5px 0;font-size:15px}}
.foot{{color:var(--mute);font-size:14px;margin-top:30px;max-width:52ch}}
@media (max-width:420px){{.motif{{display:none}}}}
</style></head><body><main>
<h1>Bell to Bell: new menu and feed music</h1>
<p class="lede">Each file plays its loop once, then the first ten seconds again, so you can hear where it wraps around. The little dots show the five-note tune that ties everything together and how it changes.</p>
{rows}
<p class="foot">These are previews rendered from the same score the game would play. The trading music is not touched. Nothing here has been run inside the game yet.</p>
</main></body></html>'''
open("/mnt/user-data/outputs/bell-to-bell-music-previews.html", "w").write(page)
import os
print(round(os.path.getsize("/mnt/user-data/outputs/bell-to-bell-music-previews.html")/1e6, 2), "MB")
