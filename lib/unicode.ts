/**
 * unicode.ts - modern unicode utilities using npm packages
 * Copyright (c) 2025, Contributors (MIT License).
 * Replaces embedded unicode libraries with proper npm dependencies
 */

// Default import, not a namespace import: eastasianwidth is CommonJS whose
// named exports Node cannot detect, so `import * as` yields a namespace
// without eastAsianWidth and every width lookup throws in the ESM bundle.
import eastasianwidth from 'eastasianwidth';
import * as unicode from 'unicode-properties';
import { emojiPresentationRanges } from './emoji-presentation-ranges.js';

/**
 * Wide, Surrogates, and Combining
 */

// Variation Selector-16 requests emoji presentation of the preceding
// character, which makes terminals render that character two cells wide.
const VS16 = 0xfe0f;

/**
 * True for code points with the Unicode `Emoji_Presentation` property, i.e.
 * the ones terminals draw two cells wide without a variation selector.
 *
 * The `eastasianwidth` package reports these Neutral because its data
 * predates Unicode 9, which reclassified emoji as Wide, so they have to be
 * detected separately. See lib/emoji-presentation-ranges.ts.
 */
function isEmojiPresentation(point: number): boolean {
  let lo = 0;
  let hi = emojiPresentationRanges.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const range = emojiPresentationRanges[mid]!;
    if (point < range[0]) {
      hi = mid - 1;
    } else if (point > range[1]) {
      lo = mid + 1;
    } else {
      return true;
    }
  }

  return false;
}

/**
 * True when the character starting at `index` is immediately followed by
 * Variation Selector-16 (e.g. U+26A0 U+FE0F "warning sign" -> 2 cells).
 */
function hasVariationSelector16(
  str: string,
  index: number,
  point: number
): boolean {
  return str.charCodeAt(index + (point > 0xffff ? 2 : 1)) === VS16;
}

function charWidth(str: string | number, i?: number): number {
  const index = typeof str === 'number' ? 0 : i || 0;
  const point = typeof str !== 'number' ? codePointAt(str, index) : str;

  // nul
  if (point === 0) return 0;

  // tab
  if (point === 0x09) {
    // Default tab width is 8, can be overridden by environment variable
    return +(process.env['BLESSED_TAB_WIDTH'] || 8);
  }

  // 8-bit control characters (2-width according to unicode??)
  if (point < 32 || (point >= 0x7f && point < 0xa0)) {
    return 0;
  }

  // Use unicode-properties to check for combining characters
  if (
    unicode.getCategory(point) === 'Mn' ||
    unicode.getCategory(point) === 'Me' ||
    unicode.getCategory(point) === 'Mc'
  ) {
    return 0;
  }

  // Emoji: two cells in every terminal that renders them, either because the
  // code point defaults to emoji presentation or because VS16 asks for it.
  // Note VS16 itself is a combining mark, so it already measured 0 above and
  // the whole sequence comes out as 2.
  if (
    isEmojiPresentation(point) ||
    (typeof str !== 'number' && hasVariationSelector16(str, index, point))
  ) {
    return 2;
  }

  // Use eastasianwidth package for proper width detection
  const width = eastasianwidth.eastAsianWidth(String.fromCodePoint(point));

  switch (width) {
    case 'F': // Fullwidth
    case 'W': // Wide
      return 2;
    case 'H': // Halfwidth
    case 'Na': // Narrow
    case 'N': // Neutral
      return 1;
    case 'A': // Ambiguous
      // Handle CJK Ambiguous based on environment variable
      if (process.env['NCURSES_CJK_WIDTH']) {
        return +process.env['NCURSES_CJK_WIDTH'] || 1;
      }
      return 1;
    default:
      return 1;
  }
}

function strWidth(str: string): number {
  let width = 0;
  for (let i = 0; i < str.length; i++) {
    width += charWidth(str, i);
    if (isSurrogate(str, i)) i++;
  }
  return width;
}

function isSurrogate(str: string | number, i?: number): boolean {
  const point = typeof str !== 'number' ? codePointAt(str, i || 0) : str;
  return point > 0x00ffff;
}

/**
 * Use unicode-properties for combining character detection
 */
function isCombining(str: string | number, i?: number): boolean {
  const point = typeof str !== 'number' ? codePointAt(str, i || 0) : str;

  const category = unicode.getCategory(point);
  return category === 'Mn' || category === 'Me' || category === 'Mc';
}

/**
 * Code Point Helpers - using native implementations when available
 */

function codePointAt(str: string, position?: number): number {
  if (str == null) {
    throw TypeError();
  }
  const string = String(str);

  // Use native implementation if available
  if (string.codePointAt) {
    return string.codePointAt(position || 0) || 0;
  }

  // Fallback implementation
  const size = string.length;
  const index = position ? Number(position) : 0;

  if (index !== index) {
    // better `isNaN`
    return 0;
  }

  // Account for out-of-bounds indices:
  if (index < 0 || index >= size) {
    return 0;
  }

  // Get the first code unit
  const first = string.charCodeAt(index);
  let second;

  if (
    // check if it's the start of a surrogate pair
    first >= 0xd800 &&
    first <= 0xdbff && // high surrogate
    size > index + 1 // there is a next code unit
  ) {
    second = string.charCodeAt(index + 1);
    if (second >= 0xdc00 && second <= 0xdfff) {
      // low surrogate
      // http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
      return (first - 0xd800) * 0x400 + second - 0xdc00 + 0x10000;
    }
  }

  return first;
}

function fromCodePoint(...codePoints: number[]): string {
  // Use native implementation if available
  if (String.fromCodePoint) {
    return String.fromCodePoint(...codePoints);
  }

  // Fallback implementation
  const MAX_SIZE = 0x4000;
  const codeUnits: number[] = [];
  let highSurrogate: number;
  let lowSurrogate: number;
  let index = -1;
  const length = codePoints.length;

  if (!length) {
    return '';
  }

  let result = '';

  while (++index < length) {
    const codePoint = Number(codePoints[index]);

    if (
      !isFinite(codePoint) || // `NaN`, `+Infinity`, or `-Infinity`
      codePoint < 0 || // not a valid Unicode code point
      codePoint > 0x10ffff || // not a valid Unicode code point
      Math.floor(codePoint) !== codePoint // not an integer
    ) {
      throw RangeError('Invalid code point: ' + codePoint);
    }

    if (codePoint <= 0xffff) {
      // BMP code point
      codeUnits.push(codePoint);
    } else {
      // Astral code point; split in surrogate halves
      // http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
      const adjustedCodePoint = codePoint - 0x10000;
      highSurrogate = (adjustedCodePoint >> 10) + 0xd800;
      lowSurrogate = (adjustedCodePoint % 0x400) + 0xdc00;
      codeUnits.push(highSurrogate, lowSurrogate);
    }

    if (index + 1 === length || codeUnits.length > MAX_SIZE) {
      result += String.fromCharCode(...codeUnits);
      codeUnits.length = 0;
    }
  }

  return result;
}

/**
 * Regexes for compatibility
 *
 * These drive layout (element.ts pads every match with a filler char so the
 * double-width glyph does not eat its neighbour), so they have to agree with
 * charWidth above - hence the emoji parts below are derived from the same
 * Emoji_Presentation data.
 */

function escapeUnit(codeUnit: number): string {
  return '\\u' + codeUnit.toString(16).padStart(4, '0');
}

function unitRange(lo: number, hi: number): string {
  return lo === hi ? escapeUnit(lo) : escapeUnit(lo) + '-' + escapeUnit(hi);
}

// BMP emoji (watch, star, check mark, ...) as character class members.
const emojiBmpRanges = emojiPresentationRanges
  .filter(([, hi]) => hi <= 0xffff)
  .map(([lo, hi]) => unitRange(lo, hi))
  .join('');

// Astral emoji as surrogate pair alternatives: a code point range maps to one
// alternative per high surrogate, since each high surrogate covers 0x400 code
// points.
function surrogatePairAlternatives([lo, hi]: readonly [
  number,
  number,
]): string {
  const parts: string[] = [];
  let start = lo;

  while (start <= hi) {
    const high = 0xd800 + ((start - 0x10000) >> 10);
    const blockEnd = Math.min(hi, ((start - 0x10000) | 0x3ff) + 0x10000);
    const low = unitRange(
      0xdc00 + ((start - 0x10000) & 0x3ff),
      0xdc00 + ((blockEnd - 0x10000) & 0x3ff)
    );
    parts.push(escapeUnit(high) + '[' + low + ']');
    start = blockEnd + 1;
  }

  return parts.join('|');
}

const emojiSurrogateSource = emojiPresentationRanges
  .filter(([, hi]) => hi > 0xffff)
  .map(surrogatePairAlternatives)
  .join('|');

// Any character followed by Variation Selector-16, which upgrades a
// text-presentation character to a two-cell emoji (U+26A0 U+FE0F). Listed
// before the plain wide alternatives so a redundant VS16 after an already
// wide emoji is consumed by the same match instead of being left behind.
const variationSelectorSource =
  '[\\ud800-\\udbff][\\udc00-\\udfff]\\ufe0f|[\\s\\S]\\ufe0f';

const chars = {
  // Double width characters that are _not_ surrogate pairs.
  wide: new RegExp(
    '([' +
      '\\u1100-\\u115f' + // Hangul Jamo init. consonants
      '\\u2329\\u232a' +
      '\\u2e80-\\u303e\\u3040-\\ua4cf' + // CJK ... Yi
      '\\uac00-\\ud7a3' + // Hangul Syllables
      '\\uf900-\\ufaff' + // CJK Compatibility Ideographs
      '\\ufe10-\\ufe19' + // Vertical forms
      '\\ufe30-\\ufe6f' + // CJK Compatibility Forms
      '\\uff00-\\uff60' + // Fullwidth Forms
      '\\uffe0-\\uffe6' +
      emojiBmpRanges + // Emoji rendered two cells wide
      '])',
    'g'
  ),

  // All surrogate pair wide chars.
  swide: new RegExp(
    '(' +
      // Emoji rendered two cells wide:
      emojiSurrogateSource +
      '|' +
      // 0x20000 - 0x2fffd:
      '[\\ud840-\\ud87f][\\udc00-\\udffd]' +
      '|' +
      // 0x30000 - 0x3fffd:
      '[\\ud880-\\ud8bf][\\udc00-\\udffd]' +
      ')',
    'g'
  ),

  // Regex to detect a surrogate pair.
  surrogate: /[\ud800-\udbff][\udc00-\udfff]/g,

  // Basic combining regex (simplified, using unicode-properties for actual detection)
  combining:
    /[\u0300-\u036f\u0483-\u0489\u0591-\u05bd\u05bf\u05c1-\u05c2\u05c4-\u05c5\u05c7\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06dc\u06df-\u06e4\u06e7-\u06e8\u06ea-\u06ed]/g,
};

// All wide chars including surrogate pairs.
const charsWithAll = {
  ...chars,
  all: new RegExp(
    '(' +
      variationSelectorSource +
      '|' +
      chars.swide.source.slice(1, -1) +
      '|' +
      chars.wide.source.slice(1, -1) +
      ')',
    'g'
  ),
};

// Backward compatibility - these were exports in the original

// Legacy export compatibility
const combining = {};
const combiningTable: number[][] = [];

// Initialize combining lookup for backward compatibility
function initializeCombining() {
  for (let i = 0; i <= 0x10ffff; i++) {
    const category = unicode.getCategory(i);
    if (category === 'Mn' || category === 'Me' || category === 'Mc') {
      (combining as any)[i] = true;
    }
  }
}

// Lazy initialization
let combiningInitialized = false;

function ensureCombiningInitialized() {
  if (!combiningInitialized) {
    initializeCombining();
    combiningInitialized = true;
  }
}

// Legacy exports for CommonJS compatibility
const combiningProxy = new Proxy(
  {},
  {
    get(_target, prop) {
      ensureCombiningInitialized();
      return (combining as any)[prop];
    },
  }
);

// Export everything properly for ESM
export {
  charWidth,
  strWidth,
  isSurrogate,
  isCombining,
  codePointAt,
  fromCodePoint,
  charsWithAll as chars,
  combiningProxy as combining,
  combiningTable,
};
