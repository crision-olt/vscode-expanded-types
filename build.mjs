import esbuild from 'esbuild';
import fs from 'fs';

const watch = process.argv.includes('--watch');

const base = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  sourcemap: watch ? 'inline' : false,
  minify: !watch,
};

// tsserver finds plugins by searching node_modules in the probe location (extension dir).
// The plugin must live at node_modules/expanded-types-plugin/ so tsserver can require() it.
const PLUGIN_PKG = 'node_modules/expanded-types-plugin';
function ensurePluginPkg() {
  fs.mkdirSync(PLUGIN_PKG, { recursive: true });
  fs.writeFileSync(`${PLUGIN_PKG}/package.json`, JSON.stringify({ name: 'expanded-types-plugin', main: 'index.js' }));
}

const extensionConfig = { ...base, entryPoints: ['src/extension.ts'], outfile: 'out/extension.js', external: ['vscode'] };
const pluginConfig = { ...base, entryPoints: ['src/plugin/index.ts'], outfile: `${PLUGIN_PKG}/index.js`, external: ['typescript'] };

ensurePluginPkg();

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
