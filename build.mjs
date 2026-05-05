import esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const base = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  sourcemap: watch ? 'inline' : false,
  minify: !watch,
};

await esbuild.build({
  ...base,
  entryPoints: ['src/extension.ts'],
  outfile: 'out/extension.js',
  external: ['vscode'],
});

await esbuild.build({
  ...base,
  entryPoints: ['src/plugin/index.ts'],
  outfile: 'out/plugin/index.js',
  external: ['typescript'],
});

console.log('Build complete.');
