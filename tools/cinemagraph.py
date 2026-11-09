"""Oddbird hero cinemagraph: bubbles rising in the spritz + condensation drops
running down the cans. Everything else in the photo stays still.

Seamless loop: every motion is periodic in the loop length T.
Writes raw RGB frames to stdout (pipe into ffmpeg), or a preview PNG with
--still <seconds>.
"""
import sys
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

BASE, INK = sys.argv[1], sys.argv[2]
FPS, T = 24, 12.0
N = int(FPS * T)
rng = np.random.default_rng(11)

img = Image.open(BASE).convert("RGB")
W, H = img.size
base = np.asarray(img, np.float32)
ink = np.asarray(Image.open(INK).convert("L"), np.float32) / 255
# "clean" can surface: micro-droplets wiped (what a drip leaves behind)
clean = np.asarray(img.filter(ImageFilter.MedianFilter(9)), np.float32)
clean = clean * (1 - ink[..., None]) + base * ink[..., None]  # never smear the logo

# ---------------------------------------------------------------- glass ---
GX0, GY0, GX1, GY1 = 720, 440, 1060, 690
blur = np.asarray(img.filter(ImageFilter.GaussianBlur(3)), np.float32)
r, g, b = blur[..., 0], blur[..., 1], blur[..., 2]
liquid = ((r > 110) & (g < 100) & (b < 100) & (r > g * 1.8)).astype(np.float32)
yy, xx = np.mgrid[0:H, 0:W]
CX = 890.5


def bowl_half_width(y):
    y = np.asarray(y, np.float32)
    top = 145 + (158 - 145) * np.clip((y - 465) / 75, 0, 1)
    t = np.clip((y - 540) / 128, 0, 1)
    low = 158 * np.power(np.clip(1 - t ** 2.4, 0, 1), 1 / 2.4)
    return np.where(y < 540, top, low)


SURFACE = 463.0
bowl = (np.abs(xx - CX) < bowl_half_width(yy) - 5) & (yy > SURFACE) & (yy < 664)
mask = Image.fromarray((liquid * bowl * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5))
glass_mask = np.asarray(mask, np.float32)[GY0:GY1, GX0:GX1] / 255
# fade bubbles just under the surface so they "pop" rather than clip
surf_fade = np.clip((np.arange(GY0, GY1) - SURFACE) / 6, 0, 1)[:, None]
glass_mask *= surf_fade


def inside(x, y):
    return abs(x - CX) < float(bowl_half_width(y)) - 10 and SURFACE + 4 < y < 655


# Bubble slots. Each slot travels its path once per period P = T / k.
bubbles = []
# streams: chains rising from nucleation points on the bowl floor/walls
for s in range(16):
    for _ in range(200):
        y0 = rng.uniform(560, 650)
        x0 = CX + rng.uniform(-1, 1) * float(bowl_half_width(y0)) * 0.85
        if inside(x0, y0):
            break
    k = int(rng.integers(3, 7))
    count = int(rng.integers(5, 10))
    r0 = rng.uniform(1.2, 1.8)
    for j in range(count):
        bubbles.append(dict(x0=x0, y0=y0, y1=SURFACE + rng.uniform(-2, 3), k=k, off=j / count,
                            r=r0, wob=rng.uniform(0.3, 0.9), ph=rng.uniform(0, 6.28), drift=rng.uniform(-6, 6)))
# loose bubbles anywhere in the drink
for _ in range(110):
    for _ in range(200):
        y0 = rng.uniform(480, 655)
        x0 = CX + rng.uniform(-1, 1) * float(bowl_half_width(y0))
        if inside(x0, y0):
            break
    bubbles.append(dict(x0=x0, y0=y0, y1=SURFACE + rng.uniform(-2, 3), k=int(rng.integers(2, 6)), off=rng.uniform(0, 1),
                        r=rng.uniform(1.0, 2.1), wob=rng.uniform(0.2, 1.2), ph=rng.uniform(0, 6.28), drift=rng.uniform(-8, 8)))

BUB = np.array([250, 178, 170], np.float32)
SS = 3


def render_bubbles(t):
    gw, gh = GX1 - GX0, GY1 - GY0
    ring = Image.new("L", (gw * SS, gh * SS), 0)
    spec = Image.new("L", (gw * SS, gh * SS), 0)
    dr, ds = ImageDraw.Draw(ring), ImageDraw.Draw(spec)
    for bb in bubbles:
        s = (t * bb["k"] / T + bb["off"]) % 1.0
        # accelerate as it rises (bubbles grow and speed up)
        p = s ** 1.35
        y = bb["y0"] + (bb["y1"] - bb["y0"]) * p
        x = bb["x0"] + bb["drift"] * p + math.sin(bb["ph"] + s * 18) * bb["wob"]
        rad = bb["r"] * (1 + 0.45 * p)
        a = min(1.0, s / 0.06)  # born
        X, Y, R = (x - GX0) * SS, (y - GY0) * SS, rad * SS
        dr.ellipse([X - R, Y - R, X + R, Y + R], fill=int(45 * a), outline=int(175 * a), width=max(1, int(SS * 0.7)))
        hr = max(0.8, R * 0.3)
        ds.ellipse([X - R * 0.35 - hr, Y - R * 0.4 - hr, X - R * 0.35 + hr, Y - R * 0.4 + hr], fill=int(235 * a))
    ring = np.asarray(ring.resize((gw, gh), Image.BOX), np.float32) / 255
    spec = np.asarray(spec.resize((gw, gh), Image.BOX), np.float32) / 255
    return ring * glass_mask, spec * glass_mask


# ---------------------------------------------------------------- drops ---
def stick_slip(s):
    """Monotonic 0..1 with two hesitations, like a real drip."""
    pts = [(0, 0), (0.22, 0.07), (0.34, 0.085), (0.58, 0.36), (0.68, 0.385), (1, 1)]
    for (s0, f0), (s1, f1) in zip(pts, pts[1:]):
        if s <= s1:
            u = (s - s0) / (s1 - s0)
            u = u * u * (3 - 2 * u)
            return f0 + (f1 - f0) * u
    return 1.0


# can geometry (for horizontal foreshortening of the drop)
CANS = [dict(cx=1126.5, R=110.5), dict(cx=1298.0, R=114.0)]
drops = [
    # x, start y, end y, can, start time, form, slide, exits (else stops & fades), size
    dict(x=1048, y0=300, y1=712, can=0, t0=0.4, form=1.6, slide=4.2, exit=True, size=1.0),
    dict(x=1363, y0=372, y1=818, can=1, t0=3.4, form=1.4, slide=4.4, exit=True, size=1.1),
    dict(x=1171, y0=468, y1=712, can=0, t0=6.6, form=1.5, slide=3.4, exit=True, size=0.85),
    dict(x=1236, y0=420, y1=698, can=1, t0=9.0, form=1.6, slide=3.6, exit=False, size=0.95),
]
TRAIL_FADE = 2.4
HOLD_FADE = 2.2

# little beads a running drop leaves behind on its path
for d in drops:
    beads, y = [], d["y0"] + rng.uniform(18, 34)
    while y < d["y1"] - 24:
        beads.append((d["x"] + rng.uniform(-1.0, 1.0), y, rng.uniform(0.26, 0.4)))
        y += rng.uniform(26, 58)
    d["beads"] = beads


def drop_state(d, t):
    u = (t - d["t0"]) % T
    life = d["form"] + d["slide"] + max(TRAIL_FADE, HOLD_FADE)
    if u > life:
        return None
    grow = min(1.0, u / d["form"])
    if u < d["form"]:
        prog, moving = 0.0, False
    else:
        prog, moving = stick_slip(min(1.0, (u - d["form"]) / d["slide"])), u < d["form"] + d["slide"]
    after = max(0.0, u - d["form"] - d["slide"])
    trail_a = 1.0 - min(1.0, after / TRAIL_FADE)
    drop_a = grow
    if d["exit"] and prog > 0.94:
        drop_a *= max(0.0, (1 - prog) / 0.06)  # slips under the rim
    if not d["exit"] and after > 0:
        drop_a *= 1 - min(1.0, after / HOLD_FADE)
    y = d["y0"] + (d["y1"] - d["y0"]) * prog
    speed = 0.0
    if moving:
        e = 1e-3
        s0 = (u - d["form"]) / d["slide"]
        speed = (stick_slip(min(1, s0 + e)) - stick_slip(max(0, s0 - e))) / (2 * e)
    return dict(y=y, grow=grow, drop_a=drop_a, trail_a=trail_a, speed=speed)


def draw_drop(frame, x, cy, a_w, a_h, A, stretch=1.0):
    """Water drop on a matte surface: lens body, lit foot, shadowed top edge,
    specular glint and a faint contact shadow."""
    x0, x1 = int(x - a_w - 5), int(x + a_w + 6)
    y0, y1 = int(cy - a_h - 6), int(cy + a_h + 6)
    sx = (np.arange(x0 * SS, x1 * SS) + 0.5) / SS
    sy = (np.arange(y0 * SS, y1 * SS) + 0.5) / SS
    X, Y = np.meshgrid(sx, sy)
    nx, ny = (X - x) / a_w, (Y - cy) / a_h
    nx = nx / np.clip(1 - 0.28 * np.clip(-ny, 0, 1) * (stretch - 0.6), 0.4, 1)  # teardrop
    rr = np.sqrt(nx ** 2 + ny ** 2)
    body = np.clip((1 - rr) * a_w * SS / 1.4, 0, 1)
    rimband = np.clip(1 - np.abs(rr - 0.84) / 0.18, 0, 1)
    rim = rimband * np.clip((nx + ny) * 0.8 + 0.3, 0, 1)
    dark = rimband * np.clip(-(nx + ny) * 0.9, 0, 1)
    spec = np.clip(1 - np.hypot(nx + 0.38, ny + 0.45) / 0.22, 0, 1)
    snx, sny = (X - x - 1.2) / a_w, (Y - cy - 1.8) / a_h
    shadow = np.clip(1 - np.sqrt(snx ** 2 + sny ** 2), 0, 1) * (1 - body)

    def down(a):
        return np.asarray(Image.fromarray(a.astype(np.float32)).resize((x1 - x0, y1 - y0), Image.BOX))

    body, rim, spec, shadow, dark = map(down, (body, rim, spec, shadow, dark))
    reg = frame[y0:y1, x0:x1]
    lens = base[y0:y1, x0:x1] * 1.06 + 4
    reg[:] = reg * (1 - (shadow * 0.13 * A)[..., None])
    reg[:] = reg * (1 - (body * A)[..., None]) + lens * (body * A)[..., None]
    reg[:] = reg * (1 - (dark * 0.3 * A)[..., None])
    reg[:] = reg + (255 - reg) * (rim * 0.55 * A)[..., None]
    reg[:] = reg + (255 - reg) * (spec * 0.9 * A)[..., None]


def render_drops(frame, t):
    for d in drops:
        st = drop_state(d, t)
        if st is None:
            continue
        can = CANS[d["can"]]
        fx = math.sqrt(max(0.15, 1 - ((d["x"] - can["cx"]) / can["R"]) ** 2))
        hw = 5.4 * d["size"] * fx
        hh = 5.8 * d["size"]
        y = st["y"]

        # trail: soft, wandering wet streak — widest just behind the drop,
        # thinning further up, wiping the micro-droplets it ran through
        if st["trail_a"] > 0 and y > d["y0"] + 2:
            y_top, y_bot = int(d["y0"]), int(y)
            x0, x1 = int(d["x"] - hw - 4), int(d["x"] + hw + 5)
            ys = np.arange(y_top, y_bot)[:, None].astype(np.float32)
            xs = np.arange(x0, x1)[None, :].astype(np.float32)
            wander = np.sin(ys * 0.045 + d["x"]) * 1.1 + np.sin(ys * 0.13 + 2 * d["x"]) * 0.45
            near = np.clip(1 - (y - ys) / 140, 0, 1)
            tw = hw * (0.32 + 0.33 * near)
            dist = np.abs(xs - d["x"] - wander)
            m = np.clip((tw - dist) / 1.8 + 0.5, 0, 1)
            m *= np.clip((ys - y_top) / 10, 0, 1) * st["trail_a"] * (0.55 + 0.45 * near)
            m *= 1 - ink[y_top:y_bot, x0:x1] * 0.75
            reg = frame[y_top:y_bot, x0:x1]
            wet = clean[y_top:y_bot, x0:x1] * 0.955
            reg[:] = reg * (1 - m[..., None]) + wet * m[..., None]
            sheen = np.clip(1 - np.abs(xs - (d["x"] + tw * 0.5 + wander)) / 0.9, 0, 1) * 0.1 * m
            reg[:] = reg + (255 - reg) * sheen[..., None]
            for bx, by, bs in d["beads"]:
                if by < y - 10:
                    draw_drop(frame, bx, by, hw * bs * 1.1, hh * bs, st["trail_a"] * 0.95)

        if st["drop_a"] <= 0.01:
            continue
        stretch = 1 + 0.45 * min(1.0, st["speed"] / 1.5)
        g = 0.55 + 0.45 * st["grow"]
        a_w, a_h = hw * g, hh * g * stretch
        draw_drop(frame, d["x"], y - a_h * 0.25, a_w, a_h, st["drop_a"], stretch)
    return frame


def frame_at(i):
    t = i / FPS
    f = base.copy()
    ring, spec = render_bubbles(t)
    reg = f[GY0:GY1, GX0:GX1]
    reg[:] = reg + (BUB - reg) * (ring * 0.78)[..., None]
    reg[:] = reg + (255 - reg) * (spec * 0.7)[..., None]
    f = render_drops(f, t)
    return np.clip(f, 0, 255).astype(np.uint8)


if __name__ == "__main__":
    if len(sys.argv) > 3 and sys.argv[3] == "--still":
        for sec in sys.argv[4:]:
            Image.fromarray(frame_at(int(float(sec) * FPS))).save(f"{sys.argv[-1] if False else ''}still-{sec}.png")
    else:
        out = sys.stdout.buffer
        for i in range(N):
            out.write(frame_at(i).tobytes())
