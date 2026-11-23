"""Generates the extension icons (run: python3 scripts/make_icons.py)."""
from PIL import Image, ImageDraw

S = 1024
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
# background: rounded square, calm blue
d.rounded_rectangle((40, 40, S - 40, S - 40), radius=220, fill=(47, 111, 222, 255))
# three "tab groups": colored label + white tabs
rows = [((246, 180, 0), 3), ((229, 85, 155), 2), ((31, 181, 201), 4)]
y = 250
for color, ntabs in rows:
    h = 130
    d.rounded_rectangle((170, y, 300, y + h), radius=50, fill=color + (255,))
    x = 330
    w = (S - 170 - x - (ntabs - 1) * 22) / ntabs
    for i in range(ntabs):
        d.rounded_rectangle((x, y, x + w, y + h), radius=40, fill=(255, 255, 255, 235))
        x += w + 22
    y += h + 60
for size in (16, 32, 48, 128):
    img.resize((size, size), Image.LANCZOS).save(f"extension/icons/icon-{size}.png")
img.resize((512, 512), Image.LANCZOS).save("store/icon-512.png")
print("ok")
