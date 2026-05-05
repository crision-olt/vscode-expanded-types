import esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const base = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  sourcemap: watch ? 'inline' : false,
  minify: !watch,
};

const extensionConfig = { ...base, entryPoints: ['src/extension.ts'], outfile: 'out/extension.js', external: ['vscode'] };
const pluginConfig = { ...base, entryPoints: ['src/plugin/index.ts'], outfile: 'out/plugin/index.js', external: ['typescript'] };

if (watch) {
  const [ctx1, ctx2] = await Promise.all([
    esbuild.context(extensionConfig),
    esbuild.context(pluginConfig),
  ]);
  await Promise.all([ctx1.watch(), ctx2.watch()]);
  console.log('Watching for changes…');
} else {
  await Promise.all([esbuild.build(extensionConfig), esbuild.build(pluginConfig)]);
  console.log('Build complete.');
}
