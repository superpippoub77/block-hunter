Place the Press Start 2P webfont files here so the game uses a local font copy.

Recommended filenames (used by the project):

- PressStart2P.woff2
- PressStart2P.woff

If you have the TTF file, you can convert it to WOFF/WOFF2 using online tools or fontforge.

After placing the font files in this folder, reload the page served via HTTP (not file://). The HTML already contains an @font-face rule pointing to these files.

Notes:
- If you prefer, you can remove the Google Fonts <link> tag in the HTML once local fonts are working.
- Keep licensing in mind: include only fonts you are allowed to redistribute.
