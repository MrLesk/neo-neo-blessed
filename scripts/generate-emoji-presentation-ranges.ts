/**
 * generate-emoji-presentation-ranges.ts
 *
 * Regenerates lib/emoji-presentation-ranges.ts from the Unicode data that
 * ships with the JavaScript engine running this script, via the
 * `\p{Emoji_Presentation}` property escape.
 *
 * Emoji_Presentation is the set of code points that render as emoji by
 * default (no variation selector needed). Every terminal emulator that
 * supports emoji renders those two cells wide, but the `eastasianwidth`
 * package still reports them Neutral because its data predates Unicode 9.
 *
 * Run with a recent Node (the header records the Unicode version used):
 *
 *   npx tsx scripts/generate-emoji-presentation-ranges.ts
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_CODE_POINT = 0x10ffff;
const isEmojiPresentation = /\p{Emoji_Presentation}/u;

function collectRanges(): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let start = -1;

  for (let point = 0; point <= MAX_CODE_POINT; point++) {
    if (isEmojiPresentation.test(String.fromCodePoint(point))) {
      if (start === -1) start = point;
    } else if (start !== -1) {
      ranges.push([start, point - 1]);
      start = -1;
    }
  }
  if (start !== -1) ranges.push([start, MAX_CODE_POINT]);

  return ranges;
}

function hex(point: number): string {
  return '0x' + point.toString(16);
}

function render(ranges: Array<[number, number]>): string {
  // Indentation matches what prettier produces for the wrapped declaration
  // below, so a regenerated file passes `npm run format:check` as-is.
  const rows = ranges
    .map(([lo, hi]) => `    [${hex(lo)}, ${hex(hi)}],`)
    .join('\n');

  return `/**
 * emoji-presentation-ranges.ts - GENERATED FILE, DO NOT EDIT BY HAND.
 *
 * Regenerate with:
 *   npx tsx scripts/generate-emoji-presentation-ranges.ts
 *
 * Code point ranges with the Unicode \`Emoji_Presentation\` property: the
 * characters that render as emoji without a variation selector, and that
 * terminals therefore draw two cells wide. Generated from Unicode ${process.versions.unicode}.
 */

// Sorted, non-overlapping, inclusive [low, high] ranges.
export const emojiPresentationRanges: ReadonlyArray<readonly [number, number]> =
  [
${rows}
  ];
`;
}

const ranges = collectRanges();
const out = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'lib',
  'emoji-presentation-ranges.ts'
);
writeFileSync(out, render(ranges));
console.log(
  `Wrote ${ranges.length} ranges to ${out} (Unicode ${process.versions.unicode}).`
);
