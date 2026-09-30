"""make_game_previews.py - what the game would sound like.
  game_session_act1   a full 3:00 trading day (music + intensity changes + sound effects + ducking), Act I
  game_ramp_act2/3/4  music-only intensity ramps showing how each act's layers come in
  game_act2_ghost12   Act II at full tension with the anomaly ghost at 12
Also writes out/audibility.json: how far each sound effect sits above the music, in its own frequency band.
"""
import json
import os
import sys
import numpy as np
from scipy.signal import butter, sosfilt
import compose_game
import render
import render_adaptive as RA
from synth import SR

OUT = "out"
PACK = json.load(open("events/sfx_pack.json"))


def gain_of(key):
    return json.load(open(f"events/{key}.json"))["mix"]["trackGain"]


def music_session(act, points, dur_s, reps, cache_name=None, ghost_n=0):
    P = compose_game.build_game(act)
    if cache_name and os.path.exists(cache_name):
        return np.load(cache_name).astype(np.float64), P
    L = int(round(P.loop_seconds * SR))
    total = reps * L + int(RA.TAIL_S * SR)
    inten = RA.intensity_from_points(points, total)
    x = RA.render_adaptive(P, inten, reps=reps, ghost_n=ghost_n)
    x = x * gain_of(P.key)
    if cache_name:
        np.save(cache_name, x.astype(np.float32))
    return x, P


def soft_limit(x, ceiling=0.9):
    return np.where(np.abs(x) > 0.7, np.sign(x) * (0.7 + (ceiling - 0.7) * np.tanh((np.abs(x) - 0.7) / (ceiling - 0.7))), x)


def band_rms(x, fc, t0, w):
    lo, hi = 400.0, 4000.0      # one fixed band for every sound (the range where the music and a phone speaker both live)
    sos = butter(2, [lo, hi], btype="band", fs=SR, output="sos")
    seg = x[int(t0 * SR):int((t0 + w) * SR)]
    if len(seg) < 64:
        return -120.0
    y = sosfilt(sos, seg.mean(axis=1) if seg.ndim == 2 else seg)
    return 20 * np.log10(np.sqrt((y ** 2).mean()) + 1e-12)


def _aw_sos():
    from scipy.signal import bilinear_zpk, zpk2sos, sosfreqz
    z = [0, 0, 0, 0]
    p = [-2 * np.pi * 20.598997] * 2 + [-2 * np.pi * 107.65265, -2 * np.pi * 737.86223] + [-2 * np.pi * 12194.217] * 2
    zd, pd, kd = bilinear_zpk(z, p, 1.0, SR)
    sos = zpk2sos(zd, pd, kd)
    w, h = sosfreqz(sos, worN=[1000.0], fs=SR)
    sos[0, :3] /= abs(h[0])
    return sos


_AW = _aw_sos()


def aw_db(seg):
    """A-weighted RMS in dB (A-weighting approximates how loud a sound feels across pitch)."""
    m = seg.mean(axis=1) if seg.ndim == 2 else seg
    if len(m) < 64:
        return -120.0
    y = sosfilt(_AW, m)
    return 20 * np.log10(np.sqrt((y ** 2).mean()) + 1e-12)


def active_window(w, floor=0.04, cap=0.4):
    """Seconds from the start until the sound has fallen 25 dB below its peak (clamped)."""
    blk = int(0.005 * SR)
    env = np.abs(w).max(axis=1)
    n = len(env) // blk
    e = env[: n * blk].reshape(n, blk).max(axis=1)
    idx = np.where(e > e.max() * 10 ** (-25 / 20))[0]
    return float(min(max((idx[-1] + 1) * 0.005 if len(idx) else floor, floor), cap))


def centroid(x):
    m = x.mean(axis=1)
    if len(m) < 512:
        m = np.pad(m, (0, 512 - len(m)))
    w = np.abs(np.fft.rfft(m * np.hanning(len(m))))
    f = np.fft.rfftfreq(len(m), 1 / SR)
    return float((f * w).sum() / (w.sum() + 1e-12))


# ------------------------------------------------------------------------------ the 3:00 demo day
SESSION_POINTS = [(0, 0.25), (10, 0.30), (25, 0.45), (40, 0.55), (46, 0.60), (49, 0.90), (60, 0.85), (70, 0.45),
                  (90, 0.35), (120, 0.30), (135, 0.50), (150, 0.60), (165, 0.85), (175, 1.0), (180, 1.0)]
SFX_TIMELINE = [
    (0.0, "bell_open"), (7.0, "order_buy"), (8.8, "sqwak_post"), (13.5, "order_buy"), (19.0, "ui_click"),
    (20.5, "order_sell"), (20.75, "win_close"), (27.0, "sqwak_post"), (36.0, "sqwak_resqwak"),
    (47.8, "sqwak_alert_wire"), (51.5, "order_short"), (57.0, "order_reject"), (62.0, "order_cover"),
    (62.3, "win_close"), (70.0, "dm_kroll"), (72.5, "heat_up"), (78.0, "decision_prompt"),
    (84.0, "decision_tick"), (85.0, "decision_tick"), (86.0, "decision_tick"), (87.0, "decision_tick"),
    (88.0, "decision_confirm"), (96.0, "mail_new"), (104.0, "sqwak_post"), (112.0, "dm_compliance"),
    (113.6, "heat_up"), (121.0, "order_buy"), (127.0, "order_limit_set"), (133.0, "order_limit_fill"),
    (139.0, "order_sell"), (139.25, "loss_close"), (148.0, "quota_met"),
] + [(170.0 + i, "countdown_tick") for i in range(7)] + [(177.0 + i, "countdown_final") for i in range(3)] + [
    (172.0, "close_riser"), (180.0, "bell_close")]


def build_session():
    P0 = compose_game.build_game(1)
    L = P0.loop_seconds
    reps = int(np.ceil(180 / L))
    music, P = music_session(1, SESSION_POINTS, 180, reps, cache_name="out/_act1_session_music.npy")
    total = len(music)
    # the music stops with the closing bell: eased fade (time constant 0.5 s) starting at 180 s
    fade = np.ones(total)
    i0 = int(180 * SR)
    t = np.arange(total - i0) / SR
    fade[i0:] = np.exp(-t / 0.5)
    m = music * fade[:, None]
    duck_ev = []
    for (t0, sid) in SFX_TIMELINE:
        d = PACK["sounds"][sid]["duck"]
        if d > 0:
            duck_ev.append((t0, d, PACK["sounds"][sid]["durationS"]))
    end_total = int(192 * SR)
    m = m[:end_total]
    g = RA.duck_envelope(len(m), duck_ev)
    mixed = m * g[:, None]
    sfx_bus = np.zeros_like(mixed)
    rows = []
    m_ref = aw_db(m[: int(180 * SR)])      # one fixed reference: the A-weighted level of the whole day's music (no timing noise)
    for (t0, sid) in SFX_TIMELINE:
        w = RA.load_wav(f"{OUT}/sfx/{sid}.wav")
        if w.shape[1] == 1:
            w = np.repeat(w, 2, axis=1)
        i = int(t0 * SR)
        j = min(i + len(w), len(sfx_bus))
        sfx_bus[i:j] += w[: j - i]
        win = active_window(w)
        s_db = aw_db(w[: int(win * SR)])
        m_db = m_ref
        rows.append((sid, t0, round(float(s_db - m_db), 1)))
    out = soft_limit(mixed + sfx_bus)
    out[-int(2 * SR):] *= np.linspace(1, 0, int(2 * SR))[:, None]
    render.write_wav(f"{OUT}/game_session_act1.wav", out)
    render.to_mp3(f"{OUT}/game_session_act1.wav", f"{OUT}/game_session_act1.mp3", kbps=80)
    # audibility summary: median margin per sound id
    # margin for EVERY sound (not only the ones in the demo schedule), against the same fixed reference
    summary = {}
    for sid in PACK["sounds"]:
        if sid == "close_riser":
            continue
        w = RA.load_wav(f"{OUT}/sfx/{sid}.wav")
        if w.shape[1] == 1:
            w = np.repeat(w, 2, axis=1)
        win = active_window(w)
        summary[sid] = round(float(aw_db(w[: int(win * SR)]) - m_ref), 1)
    json.dump(dict(reference="A-weighted level of the whole 3:00 day of music (Act I demo schedule)",
                   per_sound_median_margin_db=summary, events=rows), open(f"{OUT}/audibility.json", "w"), indent=1)
    return summary


# ------------------------------------------------------------------------------ act ramps
def build_ramp(act, dur_s, points, reps, ghost_n=0, tag=None, start_s=0.0):
    music, P = music_session(act, points, dur_s, reps, ghost_n=ghost_n)
    x = music[int(start_s * SR):int((start_s + dur_s) * SR)]
    x = soft_limit(x)
    x[-int(1.5 * SR):] *= np.linspace(1, 0, int(1.5 * SR))[:, None]
    stem = tag or f"game_ramp_act{act}"
    render.write_wav(f"{OUT}/{stem}.wav", x)
    render.to_mp3(f"{OUT}/{stem}.wav", f"{OUT}/{stem}.mp3", kbps=80)


if __name__ == "__main__":
    what = sys.argv[1]
    if what == "session":
        s = build_session()
        print(json.dumps(s, indent=0))
    elif what == "ramps":
        ramp_pts = [(0, 0.15), (22, 0.45), (42, 0.8), (60, 1.0), (75, 0.3)]
        build_ramp(2, 75, ramp_pts, 2)
        build_ramp(3, 75, ramp_pts, 2)
        build_ramp(4, 90, [(0, 0.15), (30, 0.5), (60, 1.0), (90, 0.3)], 1)
    elif what == "ghost":
        build_ramp(2, 40, [(0, 1.0), (60, 1.0)], 1, ghost_n=12, tag="game_act2_ghost12", start_s=0.0)
