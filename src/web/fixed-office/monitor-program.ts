export type ScreenKind = 'editor' | 'terminal' | 'files';
export type ScreenFrame = { line: number; characters: number };
export type ScreenProgram = {
  kind: ScreenKind;
  seed: number;
  file: string;
  folder: string;
  lines: string[];
};

// Artwork only: these snippets never contain session messages or run as code.
export function screenProgram(id: string): ScreenProgram {
  const seed = [...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
  const kind = id.endsWith('left') ? 'terminal' : id.endsWith('right') ? 'files' : 'editor';
  const module = id.startsWith('blue')
    ? 'layout'
    : id.startsWith('green')
      ? 'garden'
      : id.startsWith('purple')
        ? 'palette'
        : id.includes('laptop')
          ? 'notebook'
          : 'studio';
  const code = [
    `import { createScene } from './${module}';`,
    "import { easing, spring } from './motion';",
    '',
    `const ${module} = createScene({`,
    "  theme: 'midnight',",
    '  light: { warmth: 0.82, bloom: 0.12 },',
    "  accent: ['cyan', 'violet', 'mint'],",
    '  spacing: [8, 16, 24],',
    '});',
    '',
    '// Small details, quiet movement.',
    'export function compose(view) {',
    '  const layers = view.layers.map(layer => ({',
    '    ...layer,',
    '    opacity: spring(layer.visible ? 1 : 0),',
    '    position: easing.soft(layer.anchor),',
    '  }));',
    '',
    '  return {',
    `    scene: ${module},`,
    "    surface: 'matte',",
    '    layers,',
    '    focus: view.activeItem,',
    '  };',
    '}',
    '',
    'const frame = compose(workspace);',
    'canvas.draw(frame.layers);',
    '// Refine the next frame.',
    '',
  ];
  const terminal = [
    `$ studio watch ${module}`,
    `  › opening ${module}/workspace`,
    '  › resolving modules',
    '  · scene.ts      → transform',
    '  · theme.css     → transform',
    '  · motion.ts     → transform',
    '  ✓ modules ready',
    '',
    '$ studio render --preview',
    '  › collecting scene layers',
    '  ▸ geometry     [========..]',
    '  ▸ materials    [==========]',
    '  ▸ lighting     [======....]',
    '  ✓ preview refreshed',
    '',
    `$ studio inspect ${module}`,
    '  · reading composition',
    '  · aligning anchors',
    '  · refining transitions',
    '  ✓ workspace ready',
    '  › watching for changes…',
    '',
  ];
  const lines = kind === 'terminal' ? terminal : code;
  const offset = seed % lines.length;
  return {
    kind,
    seed,
    file: `${module}.ts`,
    folder: module,
    lines: [...lines.slice(offset), ...lines.slice(0, offset)],
  };
}

export function frameDelay(program: ScreenProgram, frame: ScreenFrame) {
  const line = program.lines[frame.line % program.lines.length];
  if (program.kind === 'files') return 2600 + ((program.seed + frame.line * 137) % 1800);
  if (frame.characters >= line.length) {
    return frame.line % 4 === program.seed % 4
      ? 1100 + (program.seed % 700)
      : program.kind === 'terminal'
        ? 240
        : 400;
  }
  return (program.kind === 'terminal' ? 75 : 115) + ((program.seed + frame.characters * 7) % 85);
}

export function advanceFrame(program: ScreenProgram, frame: ScreenFrame): ScreenFrame {
  const text = program.lines[frame.line % program.lines.length];
  if (program.kind === 'files' || frame.characters >= text.length) {
    const line = frame.line + 1;
    return {
      line,
      characters: program.kind === 'files' ? program.lines[line % program.lines.length].length : 0,
    };
  }
  return {
    ...frame,
    characters: Math.min(
      text.length,
      frame.characters + (program.kind === 'terminal' ? 9 : 3) + ((program.seed + frame.line) % 5),
    ),
  };
}

// Preserve every source character; React escapes each token when rendered.
export function colorTokens(text: string) {
  return text
    .split(
      /(\/\/.*|"[^"\n]*"|'[^'\n]*'|`[^`\n]*`|\*\*[^*\n]+\*\*|\b(?:import|from|const|let|export|function|return|if|await|async|true|false)\b|\b\d+(?:\.\d+)?\b)/g,
    )
    .filter(Boolean)
    .map((value) => ({
      value,
      tone: value.startsWith('//')
        ? 'comment'
        : /^["'`]/.test(value)
          ? 'string'
          : value.startsWith('**')
            ? 'heading'
            : /^\d/.test(value)
              ? 'number'
              : /^(import|from|const|let|export|function|return|if|await|async|true|false)$/.test(
                    value,
                  )
                ? 'keyword'
                : 'plain',
    }));
}
