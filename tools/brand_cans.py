"""Print the Oddbird label onto the two blank cans in the hero photo.

Each label is designed flat, wrapped onto a cylinder (with a slight top-down
ellipse curve), lit with the can's own shading, and has the original
high-frequency detail (condensation droplets) laid back over the ink.
"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SRC, OUT, FONTS = sys.argv[1], sys.argv[2], sys.argv[3]
SS = 4  # supersampling factor

serif = lambda s: ImageFont.truetype(f"{FONTS}/InstrumentSerif-Regular.ttf", s)
serif_i = lambda s: ImageFont.truetype(f"{FONTS}/InstrumentSerif-Italic.ttf", s)


def sans(size, weight=600):
    f = ImageFont.truetype(f"{FONTS}/InterTight.ttf", size)
    try:
        f.set_variation_by_axes([weight])
    except Exception:
        pass
    return f


INK = np.array([52, 12, 20], float)  # deep oxblood


def label_canvas(R, H, number, flavor_lines):
    """Flat artwork for the front half of a can: width = pi*R (arc length), height H.
    Returns an L-mode alpha mask at SS scale."""
    W = int(np.pi * R * SS)
    Hs = int(H * SS)
    img = Image.new("L", (W, Hs), 0)
    d = ImageDraw.Draw(img)
    cx = W // 2

    def ctext(y, text, font, spacing=0):
        # centered text with optional letter-spacing (px at SS scale)
        if spacing:
            widths = [d.textlength(ch, font=font) for ch in text]
            total = sum(widths) + spacing * (len(text) - 1)
            x = cx - total / 2
            for ch, w in zip(text, widths):
                d.text((x, y), ch, font=font, fill=255)
                x += w + spacing
        else:
            d.text((cx, y), text, font=font, fill=255, anchor="ma")

    # --- top: small tracked caps
    top = int(0.055 * Hs)
    ctext(top, "SPARKLING", sans(int(8.2 * SS), 650), spacing=int(1.6 * SS))
    ctext(top + int(11 * SS), "BOTANICAL", sans(int(8.2 * SS), 650), spacing=int(1.6 * SS))
    # hairline
    ry = top + int(27 * SS)
    d.line([(cx - 26 * SS, ry), (cx + 26 * SS, ry)], fill=255, width=int(1.1 * SS))
    ctext(ry + int(6 * SS), number, serif_i(int(15 * SS)))

    # --- vertical wordmark, reading bottom-to-top
    word_len_target = 0.56 * Hs
    fs = 100 * SS
    f = serif(fs)
    L = d.textlength("Oddbird", font=f)
    fs = int(fs * word_len_target / L)
    f = serif(fs)
    bbox = f.getbbox("Oddbird")
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    word = Image.new("L", (tw + 20, th + 20), 0)
    ImageDraw.Draw(word).text((10 - bbox[0], 10 - bbox[1]), "Oddbird", font=f, fill=255)
    word = word.rotate(90, expand=True, resample=Image.BICUBIC)
    wy = int(0.245 * Hs)
    img.paste(255, (cx - word.width // 2, wy), word)

    # --- bottom: flavor + spec line
    by = wy + word.height + int(14 * SS)
    fl = serif_i(int(19 * SS))
    for i, line in enumerate(flavor_lines):
        ctext(by + i * int(19 * SS), line, fl)
    sy = by + len(flavor_lines) * int(19 * SS) + int(10 * SS)
    ctext(sy, "0.0% ALC  ·  355 ML", sans(int(6.4 * SS), 600), spacing=int(1.0 * SS))
    return img


def wrap(base, alpha_flat, cx, R, top, bottom, e_top, e_bot, occlude=None):
    """Sample flat label onto cylinder in image space; returns alpha (float, image res)."""
    H = bottom - top
    x0, x1 = int(cx - R), int(np.ceil(cx + R))
    xs = (np.arange(x0 * SS, x1 * SS) + 0.5) / SS
    ys = (np.arange(top * SS, bottom * SS) + 0.5) / SS
    X, Y = np.meshgrid(xs, ys)
    s = np.clip((X - cx) / R, -0.999, 0.999)
    th = np.arcsin(s)
    e = e_top + (e_bot - e_top) * (Y - top) / H
    v = (Y - top - e * np.cos(th)) * SS            # remove the "smile" curve
    u = (th + np.pi / 2) * R * SS                   # arc length
    A = np.asarray(alpha_flat, float) / 255
    ui = np.clip(u.astype(int), 0, A.shape[1] - 1)
    vi = v.astype(int)
    valid = (vi >= 0) & (vi < A.shape[0])
    a = np.where(valid, A[np.clip(vi, 0, A.shape[0] - 1), ui], 0)
    # downsample supersampled alpha
    a_img = Image.fromarray((a * 255).astype(np.uint8)).resize((x1 - x0, H), Image.LANCZOS)
    full = np.zeros(base.shape[:2], float)
    full[top:bottom, x0:x1] = np.asarray(a_img, float) / 255
    # soft fade at the silhouette edge so ink never touches the rim
    edge = np.clip((R - np.abs(np.arange(base.shape[1]) - cx)) / 6, 0, 1)
    full *= edge[None, :]
    if occlude is not None:
        full *= occlude
    return full


base_img = Image.open(SRC).convert("RGB")
base = np.asarray(base_img, float)
blur = np.asarray(base_img.filter(ImageFilter.GaussianBlur(5)), float)
detail = base - blur
lum = lambda a: a @ np.array([0.299, 0.587, 0.114])

# Orange can silhouette (in front of the pink can): left boundary by row
h, w = base.shape[:2]
yy = np.arange(h)
left_edge = np.interp(yy, [0, 236, 270, 300, 340, h], [1199, 1199, 1192, 1186, 1184, 1184])
xx = np.arange(w)
occ_pink = np.clip((left_edge[:, None] - 1.5 - xx[None, :]) / 1.5, 0, 1)
occ_pink[:236] = 1

cans = [
    # cx, R, label top, label bottom, ellipse e top/bottom, number, flavor, occlusion
    dict(cx=1126.5, R=110.5, top=206, bottom=698, et=5, eb=14, n="N° 01",
         fl=["Pink", "Grapefruit"], occ=occ_pink),
    dict(cx=1298.0, R=114.0, top=312, bottom=805, et=8, eb=18, n="N° 02",
         fl=["Blood", "Orange"], occ=None),
]

out = base.copy()
ink_mask = np.zeros(base.shape[:2], float)
for c in cans:
    H = c["bottom"] - c["top"]
    flat = label_canvas(c["R"], H, c["n"], c["fl"])
    a = wrap(base, flat, c["cx"], c["R"], c["top"], c["bottom"], c["et"], c["eb"], c["occ"])
    # local shading relative to the can's mid-tone
    ref = lum(blur[c["top"] + 40:c["bottom"] - 40, int(c["cx"] - 20):int(c["cx"] + 20)].reshape(-1, 3)).mean()
    shade = (lum(blur) / ref)[..., None]
    ink = INK[None, None, :] * (0.55 + 0.45 * shade) + 0.85 * detail
    a3 = (a * 0.97)[..., None]
    out = out * (1 - a3) + ink * a3
    ink_mask = np.maximum(ink_mask, a)

Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(OUT, optimize=True)
if len(sys.argv) > 4:
    Image.fromarray((ink_mask * 255).astype(np.uint8)).save(sys.argv[4])
print("wrote", OUT)
