import pathlib

root = pathlib.Path(__file__).resolve().parent
out = root / "assets" / "embed" / "hex"
if out.exists():
    for p in out.iterdir():
        p.unlink()
else:
    out.mkdir(parents=True)

files = {
    "button": "assets/icons/dandelion_button.png",
    "button_hover": "assets/icons/dandelion_button_hovered.png",
    "button_press": "assets/icons/dandelion_button_pressed.png",
    "header": "assets/icons/dandelion_ua_header.png",
    "logo": "assets/icons/dandelion_ua_site_logo.png",
    "lang": "assets/icons/language_button.png",
}

counts = {}
for key, path in files.items():
    hexdata = (root / path).read_bytes().hex()
    size = 12000
    n = 0
    for i in range(0, len(hexdata), size):
        part = hexdata[i : i + size]
        (out / ("%s_%02d.txt" % (key, n))).write_text("H\n" + part, encoding="ascii")
        n += 1
    counts[key] = n
    print(key, n, "chunks")

manifest = "window.DANDELION_IMG_CHUNKS = %s;\n" % counts
(root / "assets" / "embed" / "manifest.js").write_text(manifest, encoding="ascii")
print("manifest", counts)
