// Advance widths (1/1000 em) of the site fonts, from public/fonts with opentype.js, so the hub can
// size bricks and signs to their labels before troika lays the text out. Kerning is ignored.
const CHARS = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~·–";
const ADVANCE = {
  bodyBold: [213, 291, 452, 686, 668, 807, 742, 243, 384, 384, 445, 607, 278, 477, 284, 534, 680, 497, 650, 659, 683, 646, 651, 573, 677, 641, 292, 300, 517, 566, 516, 597, 845, 716, 704, 702, 716, 639, 618, 720, 745, 324, 671, 663, 597, 828, 719, 712, 676, 712, 691, 663, 630, 725, 693, 831, 690, 681, 650, 383, 533, 383, 464, 736, 398, 590, 631, 590, 631, 594, 443, 634, 650, 286, 303, 585, 286, 916, 643, 611, 631, 631, 454, 553, 467, 641, 595, 838, 588, 597, 553, 425, 265, 425, 554, 330, 567],
  display: [188, 287, 460, 833, 531, 798, 667, 301, 430, 422, 557, 602, 305, 525, 229, 573, 639, 406, 525, 528, 598, 524, 575, 500, 570, 565, 277, 277, 484, 580, 450, 584, 867, 655, 594, 561, 616, 493, 472, 621, 644, 429, 462, 620, 435, 907, 648, 696, 570, 706, 590, 531, 502, 628, 661, 953, 683, 615, 563, 385, 587, 385, 687, 636, 350, 517, 520, 424, 565, 486, 375, 516, 501, 273, 271, 531, 272, 788, 551, 513, 555, 511, 396, 450, 368, 544, 521, 752, 557, 537, 454, 362, 628, 362, 459, 309, 469],
};

export type MeasuredFont = keyof typeof ADVANCE;

// Width of one line of text in metres at the given font size (troika fontSize).
export function textWidth(text: string, font: MeasuredFont, size: number): number {
  const table = ADVANCE[font];
  let w = 0;
  for (const ch of text) {
    const i = CHARS.indexOf(ch);
    w += i >= 0 ? table[i] : 600;
  }
  return (w / 1000) * size;
}
