#!/usr/bin/env node
// Convert a TTF/OTF/WOFF font to three.js typeface JSON (for drei <Text3D> / three-stdlib FontLoader).
// Glyph conversion mirrors three/examples/jsm/loaders/TTFLoader.js (r186) so the output matches what
// TTFLoader would produce at runtime, minus the runtime opentype.js download.
//
// usage: node scripts/ttf-to-typeface.mjs <in.ttf|otf|woff> <out.typeface.json> [--charset latin|all|"chars"] [--reverse|--no-reverse]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import opentype from 'opentype.js';

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    charset: { type: 'string', default: 'latin' },
    reverse: { type: 'boolean' },
    'no-reverse': { type: 'boolean' },
  },
});
const [input, output] = positionals;
if (!input || !output) {
  console.error('usage: node scripts/ttf-to-typeface.mjs <in.ttf|otf|woff> <out.typeface.json> [--charset latin|all|"chars"] [--reverse|--no-reverse]');
  process.exit(1);
}

const ranges = (...pairs) => pairs.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i));
// Basic Latin, Latin-1, Latin Extended-A, plus common punctuation/symbols if the font has them.
const EXTRAS = [0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2026, 0x20ac, 0x20b9, 0x2122, 0x2190, 0x2191, 0x2192, 0x2193];
const LATIN = new Set([...ranges([0x20, 0x7e], [0xa0, 0xff], [0x100, 0x17f]), ...EXTRAS]);
const wanted =
  opts.charset === 'all' ? null
  : opts.charset === 'latin' ? LATIN
  : new Set([...opts.charset].map((c) => c.codePointAt(0)));

const buf = fs.readFileSync(input);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
// TrueType outlines are clockwise, CFF (most .otf) counter-clockwise; three's ShapePath.toShapes() expects TrueType winding.
const reversed = opts.reverse ? true : opts['no-reverse'] ? false : font.outlinesFormat === 'cff';

const round = Math.round;
const scale = 100000 / ((font.unitsPerEm || 2048) * 72);
const glyphIndexMap = font.encoding.cmap.glyphIndexMap;

// Each glyph is converted once (TTFLoader re-reverses glyphs shared by several code points).
const tokens = new Map();
const glyphs = {};
for (const key of Object.keys(glyphIndexMap)) {
  const unicode = Number(key);
  if (wanted && !wanted.has(unicode)) continue;
  const index = glyphIndexMap[key];
  let token = tokens.get(index);
  if (!token) {
    const glyph = font.glyphs.get(index);
    const commands = reversed ? reverseCommands(glyph.path.commands) : glyph.path.commands;
    const bbox = glyph.getBoundingBox();
    token = { ha: round(glyph.advanceWidth * scale), x_min: round(bbox.x1 * scale), x_max: round(bbox.x2 * scale), o: '' };
    for (const command of commands) {
      const type = command.type.toLowerCase() === 'c' ? 'b' : command.type.toLowerCase();
      token.o += type + ' ';
      if (command.x !== undefined && command.y !== undefined) token.o += round(command.x * scale) + ' ' + round(command.y * scale) + ' ';
      if (command.x1 !== undefined && command.y1 !== undefined) token.o += round(command.x1 * scale) + ' ' + round(command.y1 * scale) + ' ';
      if (command.x2 !== undefined && command.y2 !== undefined) token.o += round(command.x2 * scale) + ' ' + round(command.y2 * scale) + ' ';
    }
    tokens.set(index, token);
  }
  glyphs[String.fromCodePoint(unicode)] = token;
}

const json = {
  glyphs,
  familyName: font.getEnglishName('fullName'),
  ascender: round(font.ascender * scale),
  descender: round(font.descender * scale),
  underlinePosition: font.tables.post.underlinePosition,
  underlineThickness: font.tables.post.underlineThickness,
  boundingBox: {
    xMin: font.tables.head.xMin,
    xMax: font.tables.head.xMax,
    yMin: font.tables.head.yMin,
    yMax: font.tables.head.yMax,
  },
  resolution: 1000,
  original_font_information: {
    fullName: font.getEnglishName('fullName'),
    copyright: font.getEnglishName('copyright'),
    license: font.getEnglishName('license'),
    licenseURL: font.getEnglishName('licenseURL'),
  },
};

fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
fs.writeFileSync(output, JSON.stringify(json));
const missing = wanted ? [...wanted].filter((c) => !(c in glyphIndexMap)).map((c) => String.fromCodePoint(c)) : [];
console.log(`${path.basename(input)} -> ${output}: ${Object.keys(glyphs).length} code points, ${tokens.size} glyphs, ` +
  `${fs.statSync(output).size} bytes, outlines=${font.outlinesFormat}, reversed=${reversed}` +
  (missing.length ? `, ${missing.length} requested chars not in font: ${missing.slice(0, 40).join(' ')}` : ''));

// Same algorithm as TTFLoader.reverseCommands.
function reverseCommands(commands) {
  const paths = [];
  let p;
  for (const c of commands) {
    if (c.type.toLowerCase() === 'm') {
      p = [c];
      paths.push(p);
    } else if (c.type.toLowerCase() !== 'z') {
      p.push(c);
    }
  }
  const out = [];
  for (const p of paths) {
    out.push({ type: 'm', x: p[p.length - 1].x, y: p[p.length - 1].y });
    for (let i = p.length - 1; i > 0; i--) {
      const command = p[i];
      const result = { type: command.type };
      if (command.x2 !== undefined && command.y2 !== undefined) {
        result.x1 = command.x2;
        result.y1 = command.y2;
        result.x2 = command.x1;
        result.y2 = command.y1;
      } else if (command.x1 !== undefined && command.y1 !== undefined) {
        result.x1 = command.x1;
        result.y1 = command.y1;
      }
      result.x = p[i - 1].x;
      result.y = p[i - 1].y;
      out.push(result);
    }
  }
  return out;
}
