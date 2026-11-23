// Program loads its TypeScript key decoder through CommonJS.
import 'tsx/cjs';
import { PassThrough } from 'node:stream';
import { afterEach, expect, it, onTestFinished, vi } from 'vitest';
import Program from '../../lib/program.js';

function mouseProgram(terminal = 'xterm-256color') {
  vi.stubEnv('BLESSED_FORCE_MODES', undefined);
  vi.stubEnv('TMUX', undefined);
  const output = new PassThrough();
  const program = Program({
    terminal,
    input: new PassThrough(),
    output,
    tput: false,
  });
  program.isVTE = false;
  onTestFinished(() => program.destroy());
  return { program, read: () => output.read()?.toString() ?? '' };
}

function modes(...settings: string[]) {
  return settings.map(setting => '\x1b[?' + setting).join('');
}

afterEach(() => vi.unstubAllEnvs());

it.each([
  ['xterm-ghostty', ['1000h', '1002h', '1003h', '1005h']],
  ['rxvt-unicode', ['1002h', '1003h', '1015h']],
  ['rxvt', ['9h', '1000h', '1002h', '1003h']],
] as const)(
  'keeps the mouse modes selected for %s active',
  (terminal, expected) => {
    const { program, read } = mouseProgram(terminal);
    program.enableMouse();
    expect(read()).toBe(modes(...expected));
  }
);

it('keeps SGR mouse encoding active on VTE terminals', () => {
  const { program, read } = mouseProgram();
  program.isVTE = true;
  program.enableMouse();
  expect(read()).toBe(modes('1002h', '1003h', '1006h'));
});

it('adds focus reports without changing tracking and disables only configured modes', () => {
  const { program, read } = mouseProgram();
  program.setMouse({ normalMouse: true, sgrMouse: true }, true);
  expect(read()).toBe(modes('1000h', '1003h', '1006h'));
  program.setMouse(
    { sendFocus: true, utfMouse: null, urxvtMouse: undefined },
    true
  );
  expect(read()).toBe(modes('1004h'));
  program.disableMouse();
  expect(read()).toBe(modes('1000l', '1003l', '1004l', '1006l'));
  program.disableMouse();
  expect(read()).toBe('');
});

it('keeps the Linux console mouse service active across a focus update', () => {
  const { program, read } = mouseProgram('linux');
  const start = vi.spyOn(program, 'enableGpm').mockImplementation(() => {});
  const stop = vi.spyOn(program, 'disableGpm').mockImplementation(() => {});
  program.enableMouse();
  expect(read()).toBe(modes('1000h'));
  expect(start).toHaveBeenCalledOnce();
  program.setMouse({ sendFocus: true }, true);
  expect(stop).not.toHaveBeenCalled();
  program.disableMouse();
  expect(stop).toHaveBeenCalledOnce();
});

it('forwards all-motion tracking through tmux and enables button tracking in the pane', () => {
  const { program, read } = mouseProgram('screen-256color');
  program.tmux = true;
  program.tmuxVersion = 3;
  program.enableMouse();
  expect(read()).toBe(
    modes('1000h', '1002h') +
      '\x1bPtmux;\x1b' +
      modes('1003h') +
      '\x1b\\' +
      modes('1005h')
  );
});
