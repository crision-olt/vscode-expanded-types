import * as vscode from 'vscode';

let enabled = false;

export function activate(ctx: vscode.ExtensionContext): void {
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = 'expandedTypes.toggle';
  updateStatusBar(statusBar);
  statusBar.show();
  ctx.subscriptions.push(statusBar);

  const toggle = vscode.commands.registerCommand('expandedTypes.toggle', () => {
    enabled = !enabled;
    updateStatusBar(statusBar);
    syncPlugin();
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

function syncPlugin(): void {
  const tsExt = vscode.extensions.getExtension('vscode.typescript-language-features');
  if (!tsExt) return;
  const api = (tsExt.exports as any)?.getAPI(0);
  if (!api) return;
  api.configurePlugin('./out/plugin', { enabled });
}
