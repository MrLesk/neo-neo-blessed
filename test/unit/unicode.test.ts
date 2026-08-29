import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as unicode from '../../lib/unicode.js';

describe('unicode module', () => {
  let originalEnv: any;

  beforeEach(() => {
    originalEnv = {
      BLESSED_TAB_WIDTH: process.env['BLESSED_TAB_WIDTH'],
      NCURSES_CJK_WIDTH: process.env['NCURSES_CJK_WIDTH'],
    };
  });

  afterEach(() => {
    if (originalEnv.BLESSED_TAB_WIDTH !== undefined) {
      process.env['BLESSED_TAB_WIDTH'] = originalEnv.BLESSED_TAB_WIDTH;
    } else {
      delete process.env['BLESSED_TAB_WIDTH'];
    }
    if (originalEnv.NCURSES_CJK_WIDTH !== undefined) {
      process.env['NCURSES_CJK_WIDTH'] = originalEnv.NCURSES_CJK_WIDTH;
    } else {
      delete process.env['NCURSES_CJK_WIDTH'];
    }
  });

  describe('charWidth', () => {
    it('should return 0 for null character', () => {
      expect(unicode.charWidth('\0')).toBe(0);
      expect(unicode.charWidth(0)).toBe(0);
    });

    it('should return tab width for tab character', () => {
      expect(unicode.charWidth('\t')).toBe(8);
      expect(unicode.charWidth(0x09)).toBe(8);

      process.env['BLESSED_TAB_WIDTH'] = '4';
      expect(unicode.charWidth('\t')).toBe(4);

      process.env['BLESSED_TAB_WIDTH'] = '2';
      expect(unicode.charWidth('\t')).toBe(2);
    });

    it('should return 0 for control characters', () => {
      expect(unicode.charWidth('\x01')).toBe(0);
      expect(unicode.charWidth('\x1f')).toBe(0);
      expect(unicode.charWidth('\x7f')).toBe(0);
      expect(unicode.charWidth('\x9f')).toBe(0);
    });

    it('should return 1 for regular ASCII characters', () => {
      expect(unicode.charWidth('A')).toBe(1);
      expect(unicode.charWidth('z')).toBe(1);
      expect(unicode.charWidth('1')).toBe(1);
      expect(unicode.charWidth(' ')).toBe(1);
      expect(unicode.charWidth('!')).toBe(1);
    });

    it('should return 2 for wide characters', () => {
      expect(unicode.charWidth('你')).toBe(2);
      expect(unicode.charWidth('こ')).toBe(2);
      expect(unicode.charWidth('한')).toBe(2);
      expect(unicode.charWidth('😀')).toBe(2);
    });

    it('should handle string with index parameter', () => {
      const str = 'hello';
      expect(unicode.charWidth(str, 0)).toBe(1);
      expect(unicode.charWidth(str, 1)).toBe(1);
      expect(unicode.charWidth(str, 4)).toBe(1);
    });
  });

  describe('strWidth', () => {
    it('should calculate width of ASCII strings', () => {
      expect(unicode.strWidth('')).toBe(0);
      expect(unicode.strWidth('hello')).toBe(5);
      expect(unicode.strWidth('Hello World!')).toBe(12);
    });

    it('should calculate width of strings with wide characters', () => {
      expect(unicode.strWidth('你好')).toBe(4);
      expect(unicode.strWidth('Hello 你好')).toBe(10);
      expect(unicode.strWidth('😀😁')).toBe(4);
    });

    it('should handle mixed content', () => {
      expect(unicode.strWidth('A你B')).toBe(4);
      expect(unicode.strWidth('😀A')).toBe(3);
    });

    it('should handle tabs', () => {
      expect(unicode.strWidth('A\tB')).toBe(10);

      process.env['BLESSED_TAB_WIDTH'] = '4';
      expect(unicode.strWidth('A\tB')).toBe(6);
    });

    it('should handle control characters', () => {
      expect(unicode.strWidth('A\x01B')).toBe(2);
      expect(unicode.strWidth('A\0B')).toBe(2);
    });
  });

  describe('emoji width', () => {
    // Terminals render emoji-presentation characters two cells wide (Unicode 9
    // reclassified them as East Asian Wide). Both the width function and the
    // layout regexes have to agree on that, or padded output drifts by a cell
    // for every emoji on the line.
    // Cells the renderer ends up with: element.ts pads wide chars via
    // chars.all, then puts each surrogate pair in one cell and merges
    // combining marks into the preceding cell.
    const cells = (str: string) => {
      const padded = str.replace(unicode.chars.all, '$1\x03');
      let count = 0;
      for (let i = 0; i < padded.length; i++) {
        const point = unicode.codePointAt(padded, i);
        if (point > 0xffff) i++;
        if (unicode.isCombining(point)) continue;
        count++;
      }
      return count;
    };

    it('should count emoji-presentation characters as 2 cells', () => {
      expect(unicode.charWidth('😀')).toBe(2); // U+1F600
      expect(unicode.charWidth('🚀')).toBe(2); // U+1F680
      expect(unicode.charWidth('⌚')).toBe(2); // U+231A, BMP
      expect(unicode.charWidth('✅')).toBe(2); // U+2705, BMP
      expect(unicode.charWidth('⭐')).toBe(2); // U+2B50, BMP
      expect(unicode.charWidth('🧩')).toBe(2); // U+1F9E9
    });

    it('should count emoji added after Unicode 13 as 2 cells', () => {
      // These postdate the data shipped by unicode-properties, so they only
      // measure correctly against the generated Emoji_Presentation table.
      expect(unicode.charWidth('🥷')).toBe(2); // U+1F977, Unicode 13
      expect(unicode.charWidth('🫠')).toBe(2); // U+1FAE0, Unicode 14
      expect(unicode.charWidth('🩷')).toBe(2); // U+1FA77, Unicode 15
    });

    it('should leave text-presentation characters at 1 cell', () => {
      expect(unicode.charWidth('⚠')).toBe(1); // U+26A0
      expect(unicode.charWidth('❤')).toBe(1); // U+2764
      expect(unicode.charWidth('🌡')).toBe(1); // U+1F321
      expect(unicode.charWidth('✔')).toBe(1); // U+2714
    });

    it('should count a variation selector-16 sequence as 2 cells', () => {
      expect(unicode.charWidth('⚠️')).toBe(2); // U+26A0 U+FE0F
      expect(unicode.strWidth('⚠️')).toBe(2);
      expect(unicode.strWidth('❤️')).toBe(2); // U+2764 U+FE0F
      expect(unicode.strWidth('🌡️')).toBe(2); // U+1F321 U+FE0F
    });

    it('should not double-count a redundant variation selector-16', () => {
      expect(unicode.strWidth('🚀️')).toBe(2);
      expect(unicode.charWidth(0xfe0f)).toBe(0);
    });

    it('should measure emoji in strings', () => {
      expect(unicode.strWidth('🚀 ship')).toBe(7);
      expect(unicode.strWidth('BACK-123 - Fix ⚠️ handling')).toBe(26);
      expect(unicode.strWidth('🚀')).toBe(unicode.strWidth('你'));
    });

    it('should pad emoji for layout the same way it pads CJK', () => {
      // element.ts inserts a filler after every chars.all match so the wide
      // glyph does not eat its neighbour cell.
      expect('你'.replace(unicode.chars.all, '$1\x03')).toBe('你\x03');
      expect('🚀'.replace(unicode.chars.all, '$1\x03')).toBe('🚀\x03');
      expect('⭐'.replace(unicode.chars.all, '$1\x03')).toBe('⭐\x03');
      expect('⚠️'.replace(unicode.chars.all, '$1\x03')).toBe('⚠️\x03');
      // A redundant VS16 is consumed by the same match: one filler, not two.
      expect('🚀️'.replace(unicode.chars.all, '$1\x03')).toBe('🚀️\x03');
      expect('AB'.replace(unicode.chars.all, '$1\x03')).toBe('AB');
      expect('⚠'.replace(unicode.chars.all, '$1\x03')).toBe('⚠');
    });

    it('should render as many cells as it measures', () => {
      // The alignment invariant: what strWidth reserves is what the padded
      // content occupies, so an emoji row lines up with a plain one.
      for (const line of [
        'hello',
        'AB ship',
        '你 ship',
        '🚀 ship',
        '⚠️ warn',
        '🌡️ x',
        '🚀🚀',
        'BACK-123 - Fix ⚠️ handling',
      ]) {
        expect(cells(line)).toBe(unicode.strWidth(line));
      }
    });

    it('should keep charWidth and the layout regexes in agreement', () => {
      const all = new RegExp(unicode.chars.all.source);
      for (const [lo, hi] of [
        [0x2300, 0x27bf],
        [0x2b00, 0x2bff],
        [0x1f300, 0x1f9ff],
        [0x1fa70, 0x1faff],
      ]) {
        for (let point = lo; point <= hi; point++) {
          const char = String.fromCodePoint(point);
          if (unicode.charWidth(char) !== 2) continue;
          const match = all.exec(char);
          expect(match && match[0]).toBe(char);
        }
      }
    });
  });

  describe('isSurrogate', () => {
    it('should identify surrogate pairs', () => {
      expect(unicode.isSurrogate('😀')).toBe(true); // Emoji uses surrogate pairs
      expect(unicode.isSurrogate('A')).toBe(false); // ASCII doesn't
      expect(unicode.isSurrogate('你')).toBe(false); // BMP characters don't
    });

    it('should handle code points directly', () => {
      expect(unicode.isSurrogate(0x1f600)).toBe(true); // 😀 emoji code point
      expect(unicode.isSurrogate(0x41)).toBe(false); // 'A' code point
      expect(unicode.isSurrogate(0x4f60)).toBe(false); // '你' code point
    });

    it('should handle string with index', () => {
      const str = 'A😀B';
      expect(unicode.isSurrogate(str, 0)).toBe(false); // 'A'
      expect(unicode.isSurrogate(str, 1)).toBe(true); // '😀'
      // Note: surrogate pairs take 2 positions in JS strings
    });
  });

  describe('codePointAt', () => {
    it('should get code points for ASCII characters', () => {
      expect(unicode.codePointAt('A')).toBe(65);
      expect(unicode.codePointAt('a')).toBe(97);
      expect(unicode.codePointAt('1')).toBe(49);
    });

    it('should get code points for Unicode characters', () => {
      expect(unicode.codePointAt('你')).toBe(0x4f60);
      expect(unicode.codePointAt('😀')).toBe(0x1f600);
    });

    it('should handle position parameter', () => {
      const str = 'ABC';
      expect(unicode.codePointAt(str, 0)).toBe(65); // 'A'
      expect(unicode.codePointAt(str, 1)).toBe(66); // 'B'
      expect(unicode.codePointAt(str, 2)).toBe(67); // 'C'
    });

    it('should handle out-of-bounds indices', () => {
      expect(unicode.codePointAt('ABC', -1)).toBe(0);
      expect(unicode.codePointAt('ABC', 10)).toBe(0);
    });

    it('should handle surrogate pairs correctly', () => {
      const str = 'A😀B';
      expect(unicode.codePointAt(str, 0)).toBe(65); // 'A'
      expect(unicode.codePointAt(str, 1)).toBe(0x1f600); // '😀'
    });
  });

  describe('fromCodePoint', () => {
    it('should create strings from ASCII code points', () => {
      expect(unicode.fromCodePoint(65)).toBe('A');
      expect(unicode.fromCodePoint(97)).toBe('a');
      expect(unicode.fromCodePoint(48)).toBe('0');
    });

    it('should create strings from Unicode code points', () => {
      expect(unicode.fromCodePoint(0x4f60)).toBe('你');
      expect(unicode.fromCodePoint(0x1f600)).toBe('😀');
    });

    it('should handle multiple code points', () => {
      expect(unicode.fromCodePoint(65, 66, 67)).toBe('ABC');
      expect(unicode.fromCodePoint(0x4f60, 0x597d)).toBe('你好');
    });

    it('should handle surrogate pairs', () => {
      expect(unicode.fromCodePoint(0x1f600, 0x1f601)).toBe('😀😁');
    });
  });
});
