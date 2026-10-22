# python scripts/make-icons.py  (needs: pip install fonttools; run scripts/make-fonts.py first)
# Writes public/favicon.svg: an indigo "S" in Fraunces 600 (as a path, since icons can't load web fonts) on cream.
# Then run `npx tsx scripts/make-icons.ts` (or `npm run icons`) for the PNG sizes.
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

font = TTFont('scripts/assets/fraunces-600-soft.ttf')
glyphs = font.getGlyphSet()
name = font.getBestCmap()[ord('S')]
pen, box = SVGPathPen(glyphs), BoundsPen(glyphs)
glyphs[name].draw(pen); glyphs[name].draw(box)
x0, y0, x1, y1 = box.bounds
SIZE, GLYPH_H = 512, 300  # the letter fills about 60% of the icon's height
k = GLYPH_H / (y1 - y0)
tx = (SIZE - (x1 - x0) * k) / 2 - x0 * k
ty = (SIZE + (y1 - y0) * k) / 2 + y0 * k  # font units point up; flip y
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}">'
       f'<rect width="{SIZE}" height="{SIZE}" rx="112" fill="#F6F0E6"/>'
       f'<path fill="#3B4C9A" transform="translate({tx:.2f} {ty:.2f}) scale({k:.5f} {-k:.5f})" d="{pen.getCommands()}"/></svg>\n')
open('public/favicon.svg', 'w', encoding='utf-8', newline='\n').write(svg)
print('ok', len(svg), 'bytes')
