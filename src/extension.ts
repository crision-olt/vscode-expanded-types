import * as vscode from 'vscode';

let enabled = false;
let out: vscode.OutputChannel;

export function activate(ctx: vscode.ExtensionContext): void {
  out = vscode.window.createOutputChannel('Expanded Types');
  ctx.subscriptions.push(out);

  const candidates = ['vscode.typescript-language-features', 'ms-vscode.vscode-typescript-next'];
  for (const id of candidates) {
    const ext = vscode.extensions.getExtension(id);
    out.appendLine(`${id}: ${ext ? (ext.isActive ? 'active' : 'found (inactive)') : 'not found'}`);
  }

  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = 'expandedTypes.toggle';
  updateStatusBar(statusBar);
  statusBar.show();
  ctx.subscriptions.push(statusBar);

  const toggle = vscode.commands.registerCommand('expandedTypes.toggle', () => {
    enabled = !enabled;
    updateStatusBar(statusBar);
    void syncPlugin();
  });
  ctx.subscriptions.push(toggle);
}

export function deactivate(): void {}

function updateStatusBar(item: vscode.StatusBarItem): void {
  if (enabled) {
    item.text = '$(eye) TS: Expanded';
    item.tooltip = 'Expanded Types: ON — Click to disable';
  } else {
    item.text = '$(type-hierarchy) TS: Normal';
    item.tooltip = 'Expanded Types: OFF — Click to enable';
  }
}

async function syncPlugin(): Promise<void> {
  // The nightly extension takes over tsserver from the built-in one; try both.
  const candidates = [
    'vscode.typescript-language-features',
    'ms-vscode.vscode-typescript-next',
  ];

  for (const id of candidates) {
    const ext = vscode.extensions.getExtension(id);
    if (!ext) { out.appendLine(`syncPlugin: ${id} not found`); continue; }
    await ext.activate();
    const api = (ext.exports as any)?.getAPI(0);
    out.appendLine(`syncPlugin: ${id} api=${api ? 'ok' : 'null'} configurePlugin=${typeof api?.configurePlugin}`);
    if (!api?.configurePlugin) continue;
    api.configurePlugin('expanded-types-plugin', { enabled });
    out.appendLine(`syncPlugin: configurePlugin called with enabled=${String(enabled)}`);
    return;
  }

  const msg = `TypeScript plugin API not found (tried: ${candidates.join(', ')})`;
  out.appendLine(`syncPlugin: FAILED — ${msg}`);
  vscode.window.showWarningMessage(`Expanded Types: ${msg}`);
}
