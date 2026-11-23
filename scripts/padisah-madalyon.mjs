import {writeFileSync} from 'node:fs';
const {PADISAH_DEFS} = await import(process.argv[2]);
const out = process.argv[3];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
for (const [id, , d] of PADISAH_DEFS) {
  const {main, accent} = d.palette;
  const label = d.title.toLocaleUpperCase('tr-TR');
  const fs = label.length > 11 ? 62 : 74;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
<defs><radialGradient id="g" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="${main}"/><stop offset="1" stop-color="#0b0820"/></radialGradient>
<pattern id="p" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M40 6 L48 32 L74 40 L48 48 L40 74 L32 48 L6 40 L32 32Z" fill="${accent}" opacity=".07"/></pattern></defs>
<rect width="800" height="800" fill="url(#g)"/><rect width="800" height="800" fill="url(#p)"/>
<circle cx="400" cy="330" r="250" fill="none" stroke="${accent}" stroke-width="10" opacity=".9"/>
<circle cx="400" cy="330" r="226" fill="none" stroke="${accent}" stroke-width="3" opacity=".55"/>
<g fill="${accent}"><path d="M362 170 a92 92 0 1 0 0 150 a74 74 0 1 1 0 -150z"/><path d="M432 214 l9 27 h28 l-23 17 9 27 -23 -17 -23 17 9 -27 -23 -17 h28z"/></g>
<text x="400" y="440" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="120" font-weight="700" fill="#fff7e6">${ROMAN[d.no]}</text>
<text x="400" y="660" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="${fs}" font-weight="700" letter-spacing="4" fill="${accent}">${esc(label)}</text>
<text x="400" y="722" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="34" fill="#fff7e6" opacity=".85">${esc(d.reign)}</text>
</svg>
`;
  writeFileSync(`${out}/${id}.svg`, svg);
}
console.log('ok', PADISAH_DEFS.length);
