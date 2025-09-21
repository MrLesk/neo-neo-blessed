/**
 * blessed - a high-level terminal interface library for node.js
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

import program from './program.js';
import tput, { sprintf, tryRead } from './tput.js';
import widget from './widget.js';
// Re-export core factories as named ESM exports for first-class module usage
// This avoids consumers needing to import the default namespace just to reach
// widget constructors (e.g. `import { box } from "blessed"`).
// Keep program/tput as named exports
export { default as program } from './program.js';
export { default as tput } from './tput.js';
// Surface widget factories as simple named bindings (typed as any).
// This avoids d.ts build issues from re-exporting every widget module directly.
// Consumers still get ergonomic ESM imports.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const screen: any = (widget as any).screen;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const box: any = (widget as any).box;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const text: any = (widget as any).text;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const line: any = (widget as any).line;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const list: any = (widget as any).list;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const scrollablebox: any = (widget as any).scrollablebox;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const scrollabletext: any = (widget as any).scrollabletext;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const log: any = (widget as any).log;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const textbox: any = (widget as any).textbox;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const textarea: any = (widget as any).textarea;
import * as colors from './colors.js';
import * as unicode from './unicode.js';
import * as helpers from './helpers.js';
import './events.js'; // Apply EventEmitter extensions

/**
 * The main blessed namespace that provides access to all widgets and functionality.
 *
 * @example
 * ```typescript
 * import blessed from 'neo-neo-blessed';
 *
 * const screen = blessed.screen({
 *   smartCSR: true
 * });
 *
 * const box = blessed.box({
 *   parent: screen,
 *   top: 'center',
 *   left: 'center',
 *   width: '50%',
 *   height: '50%',
 *   content: 'Hello World!',
 *   tags: true,
 *   border: {
 *     type: 'line'
 *   },
 *   style: {
 *     fg: 'white',
 *     bg: 'magenta',
 *     border: {
 *       fg: '#f0f0f0'
 *     },
 *     hover: {
 *       bg: 'green'
 *     }
 *   }
 * });
 *
 * screen.render();
 * ```
 */
function blessed() {
  return blessed.program.apply(null, arguments);
}

blessed.program = blessed.Program = program;
blessed.tput = blessed.Tput = tput;
blessed.widget = widget;
blessed.colors = colors;
blessed.unicode = unicode;
blessed.helpers = helpers;

(blessed.helpers as any).sprintf = sprintf;
(blessed.helpers as any).tryRead = tryRead;
blessed.helpers.merge(blessed, blessed.helpers);

blessed.helpers.merge(blessed, blessed.widget);

/**
 * Expose
 */

export default blessed;
