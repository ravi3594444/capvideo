"""Regenerate the homepage WebP from the source cards listed in landingExamples.ts."""

import re
from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parent.parent
examples = root / "src/utils/landingExamples.ts"
showcase = root / "public/assets/showcase"
names = re.findall(r"^  \['([a-z]+)',", examples.read_text(), re.MULTILINE)
assert len(names) == 20, "Update the sprite grid and CSS if the card count changes."

width, height = 140, 196
sprite = Image.new("RGB", (width * 5, height * 4))
for index, name in enumerate(names):
    with Image.open(showcase / f"{name}.webp") as source:
        card = source.resize((width, height), Image.Resampling.LANCZOS)
        sprite.paste(card, (index % 5 * width, index // 5 * height))

sprite.save(showcase / "cards.webp", quality=75, method=6)
