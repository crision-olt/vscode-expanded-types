import * as vscode from 'vscode';

let out: vscode.OutputChannel;

export function activate(ctx: vscode.ExtensionContext): void {
  out = vscode.window.createOutputChannel('Expanded Types');
  ctx.subscriptions.push(out);

  const cfg = vscode.workspace.getConfiguration('expandedTypes');
  let enabled: boolean = cfg.get('enabled', false);

  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = 'expandedTypes.toggle';
  updateStatusBar(statusBar, enabled, false);
  statusBar.show();
  ctx.subscriptions.push(statusBar);

  const toggle = vscode.commands.registerCommand('expandedTypes.toggle', () => {
    enabled = !enabled;
    void vscode.workspace.getConfiguration('expandedTypes')
      .update('enabled', enabled, vscode.ConfigurationTarget.Global);
    updateStatusBar(statusBar, enabled, false);
    void syncPlugin(enabled, statusBar);
  });
  ctx.subscriptions.push(toggle);

  const copyCmd = vscode.commands.registerCommand('expandedTypes.copyAtCursor', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('Expanded Types: no active editor');
      return;
    }
    const position = editor.selection.active;
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      'vscode.executeHoverProvider',
      editor.document.uri,
      position,
    );
    if (!hovers?.length) {
      vscode.window.showInformationMessage('Expanded Types: no hover at cursor');
      return;
    }
    for (const hover of hovers) {
      for (const content of hover.contents) {
        const text = typeof content === 'string'
          ? content
          : (content as vscode.MarkdownString).value;
        const match = /```typescript\n([\s\S]*?)\n```/.exec(text);
        if (match) {
          await vscode.env.clipboard.writeText(match[1]);
          vscode.window.showInformationMessage('Expanded Types: copied to clipboard');
          return;
        }
      }
    }
    vscode.window.showInformationMessage('Expanded Types: no expanded type block found at cursor (is expansion enabled?)');
  });
  ctx.subscriptions.push(copyCmd);

  const cfgListener = vscode.workspace.onDidChangeConfiguration(e => {
    if (!e.affectsConfiguration('expandedTypes')) return;
    const updated = vscode.workspace.getConfiguration('expandedTypes');
    enabled = updated.get('enabled', false);
    updateStatusBar(statusBar, enabled, false);
    void syncPlugin(enabled, statusBar);
  });
  ctx.subscriptions.push(cfgListener);

  void syncPlugin(enabled, statusBar);
}

export function deactivate(): void {}

function updateStatusBar(
  item: vscode.StatusBarItem,
  enabled: boolean,
  hasError: boolean,
): void {
  if (hasError) {
    item.text = '$(warning) TS: Not connected';
    item.tooltip = 'Expanded Types: Could not connect to TypeScript server — is a TS file open?';
    item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
  } else if (enabled) {
    item.text = '$(eye) TS: Expanded';
    item.tooltip = 'Expanded Types: ON — Click to disable';
    item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  } else {
    item.text = '$(type-hierarchy) TS: Normal';
    item.tooltip = 'Expanded Types: OFF — Click to enable';
    item.backgroundColor = undefined;
  }
}

async function syncPlugin(
  enabled: boolean,
  statusBar: vscode.StatusBarItem,
): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('expandedTypes');
  const maxDepth: number = cfg.get('maxDepth', 5);
  const keepOriginalDocs: boolean = cfg.get('keepOriginalDocs', true);

  const candidates = [
    'vscode.typescript-language-features',
    'ms-vscode.vscode-typescript-next',
  ];

  for (const id of candidates) {
    const ext = vscode.extensions.getExtension(id);
    if (!ext) { out.appendLine(`syncPlugin: ${id} not found`); continue; }
    await ext.activate();
    const api = (ext.exports as any)?.getAPI(0);
    out.appendLine(`syncPlugin: ${id} api=${api ? 'ok' : 'null'}`);
    if (!api?.configurePlugin) continue;
    api.configurePlugin('expanded-types-plugin', { enabled, maxDepth, keepOriginalDocs });
    out.appendLine(`syncPlugin: configured enabled=${String(enabled)} maxDepth=${maxDepth}`);
    updateStatusBar(statusBar, enabled, false);
    return;
  }

  out.appendLine('syncPlugin: TypeScript extension API not found');
  updateStatusBar(statusBar, enabled, true);
  if (enabled) {
    vscode.window.showWarningMessage(
      'Expanded Types: TypeScript server API not found. Open a TypeScript file and try toggling again.',
    );
  }
}
