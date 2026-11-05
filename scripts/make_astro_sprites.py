"""Build the astronaut pet's sprite sheets from the Pixabay green-screen clip.

Source: https://pixabay.com/videos/ai-generated-astronaut-green-screen-222138/ (Pixabay Content License)
Usage:  ffmpeg -i assets/source/astronaut-222138-small.mp4 -vf fps=12 FRAMES/%04d.png
        python scripts/make_astro_sprites.py FRAMES public/pets/astro
Needs Pillow + numpy.
"""
import sys, json, os
import numpy as np
from PIL import Image

FW, FH, COLS = 200, 300, 12
CX, BOTTOM = 480, 500          # body centre / below-the-feet line in source pixels
BASE_W, BASE_H = 320, 480      # source window for the reference (idle) clip
# name: (first frame, last frame inclusive, size normalisation so all clips match the idle body)
CLIPS = {
    'idle': (12, 95, 1.00),    # front-facing float, seamless loop
    'side': (228, 335, 1.07),  # three-quarter sway, used while travelling
    'wave': (396, 443, 0.88),  # waves at you
}

def key(frame):
    a = np.asarray(frame.convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    spill = g - np.maximum(r, b)
    alpha = 1 - np.clip((spill - 18) / 50, 0, 1)
    g2 = np.minimum(g, np.maximum(r, b) + 6)   # despill green fringes
    out = np.dstack([r, g2, b, alpha * 255]).clip(0, 255).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')

def main(src, dst):
    os.makedirs(dst, exist_ok=True)
    meta = {'fw': FW, 'fh': FH, 'cols': COLS, 'fps': 12, 'clips': {}}
    for name, (a, b, s) in CLIPS.items():
        w, h = BASE_W / s, BASE_H / s
        box = (CX - w / 2, BOTTOM - h, CX + w / 2, BOTTOM)
        n = b - a + 1
        rows = (n + COLS - 1) // COLS
        sheet = Image.new('RGBA', (FW * COLS, FH * rows), (0, 0, 0, 0))
        for i in range(n):
            f = Image.open(f'{src}/{a + i + 1:04d}.png')  # ffmpeg numbers from 1
            k = key(f).crop(tuple(round(v) for v in box)).resize((FW, FH), Image.LANCZOS)
            sheet.paste(k, ((i % COLS) * FW, (i // COLS) * FH))
        sheet.save(f'{dst}/{name}.webp', 'WEBP', quality=82, method=6, alpha_quality=90)
        meta['clips'][name] = {'frames': n, 'rows': rows}
        print(name, n, os.path.getsize(f'{dst}/{name}.webp') // 1024, 'KB')
    with open(f'{dst}/sprites.json', 'w') as fh:
        json.dump(meta, fh, indent=1)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
