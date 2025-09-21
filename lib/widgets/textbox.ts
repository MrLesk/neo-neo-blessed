/**
 * textbox.js - textbox element for blessed
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

/**
 * Modules
 */

import Node from './node.js';
import textareaFactory from './textarea.js';
const Textarea = textareaFactory.Textarea;

/**
 * Type definitions
 */

interface TextboxOptions {
  scrollable?: boolean;
  secret?: boolean;
  censor?: boolean;
  ignoreKeys?: string[]; // Array of key names to ignore (e.g., ['tab', 'f1'])
  [key: string]: any;
}

interface TextboxKey {
  name: string;
}

interface TextboxScreen {
  tabc: string;
}

interface TextboxInterface extends Textarea {
  type: string;
  secret?: boolean;
  censor?: boolean;
  ignoreKeys?: string[];
  value: string;
  _value: string;
  width: number;
  iwidth: number;
  screen: TextboxScreen;
  __listener?: (ch: string, key: TextboxKey) => void;
  __olistener: (ch: string, key: TextboxKey) => any;
  _listener: (ch: string, key: TextboxKey) => any;
  _done: (err: any, value?: string) => void;
  setContent(content: string): void;
  _updateCursor(): void;
  setValue(value?: string): void;
  submit(): any;
}

/**
 * Textbox - Modern ES6 Class
 */

class Textbox extends Textarea {
  type = 'textbox';
  secret?: boolean;
  censor?: boolean;
  ignoreKeys?: string[];
  __olistener: (ch: string, key: TextboxKey) => any;

  constructor(options?: TextboxOptions) {
    // Handle malformed options gracefully
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      options = {};
    }

    // Force scrollable to false for textbox (single-line input)
    options.scrollable = false;

    super(options);

    this.secret = options.secret;
    this.censor = options.censor;
    this.ignoreKeys = options.ignoreKeys || [];
  }

  // Override _listener to handle textbox-specific behavior
  _listener(ch: string, key: TextboxKey): void {
    // Handle enter key for single-line submission
    if (key.name === 'enter') {
      this._done(null, this.value);
      return;
    }

    // Check if this key should be ignored based on configuration
    if (this.ignoreKeys && this.ignoreKeys.length > 0) {
      // Check by key name
      if (key.name && this.ignoreKeys.includes(key.name)) {
        return; // Ignore this key
      }

      // Also check by character for special chars like tab
      if (ch) {
        // Map common special characters to their key names
        const charToKeyName: { [key: string]: string } = {
          '\t': 'tab',
          '\x1b': 'escape',
          '\r': 'return',
          '\n': 'enter',
        };

        const keyName = charToKeyName[ch];
        if (keyName && this.ignoreKeys.includes(keyName)) {
          return; // Ignore this character
        }
      }
    }

    // For all other keys, call parent's textarea _listener
    super._listener(ch, key);
  }

  setValue(value?: string): void {
    let visible: number, val: string;
    if (value == null) {
      value = this.value;
    }
    if (this._value !== value) {
      // Remove newlines for single-line textbox
      value = value.replace(/\n/g, '');
      this.value = value;
      this._value = value;
      if (this.secret) {
        this.setContent('');
      } else if (this.censor) {
        this.setContent(Array(this.value.length + 1).join('*'));
      } else {
        visible = -(this.width - this.iwidth - 1);
        val = this.value.replace(/\t/g, this.screen.tabc);
        this.setContent(val.slice(visible));
      }
      this._updateCursor();
    }
  }

  submit(): any {
    if (!this._done) return;
    return this._done(null, this.value);
  }
}

/**
 * Factory function for backward compatibility
 */
function textbox(options?: TextboxOptions): TextboxInterface {
  return new Textbox(options) as TextboxInterface;
}

// Attach the class as a property for direct access
textbox.Textbox = Textbox;

/**
 * Expose
 */

export default textbox;
