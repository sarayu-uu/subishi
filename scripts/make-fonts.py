# python scripts/make-fonts.py  (needs: pip install fonttools brotli)
# Cuts the one Fraunces style the site uses out of the variable font from @fontsource-variable/fraunces (Latin, SIL OFL):
#   weight 600, SOFT 50 (rounder), WONK off. opsz stays variable so headings still tune to their size.
#   src/assets/fonts/fraunces-600-soft-latin.woff2 — for the page
#   scripts/assets/fraunces-600-soft.ttf          — for the link-preview images (opsz fixed at 72, display size)
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

SRC = 'node_modules/@fontsource-variable/fraunces/files/fraunces-latin-full-normal.woff2'

web = instantiateVariableFont(TTFont(SRC), {'wght': 600, 'SOFT': 50, 'WONK': 0}, updateFontNames=False)
web.flavor = 'woff2'
web.save('src/assets/fonts/fraunces-600-soft-latin.woff2')

og = instantiateVariableFont(TTFont(SRC), {'wght': 600, 'SOFT': 50, 'WONK': 0, 'opsz': 72}, updateFontNames=False)
og.flavor = None
og.save('scripts/assets/fraunces-600-soft.ttf')
print('ok')
