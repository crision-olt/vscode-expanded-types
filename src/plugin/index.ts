import type * as ts from 'typescript';
import { expandType } from './expander';

function buildCodeContent(original: ts.QuickInfo | undefined, expanded: string): string {
  const parts = original?.displayParts ?? [];
  let eqIdx = -1;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if ((p.kind === 'operator' || p.kind === 'punctuation') && p.text === '=') {
      eqIdx = i;
      break;
    }
  }
  if (eqIdx < 0) return expanded;
  const prefix = parts.slice(0, eqIdx).map(p => p.text).join('').trimEnd() + ' = ';
  return prefix + expanded;
}

function init(modules: { typescript: typeof ts }) {
  const tsModule = modules.typescript;
  let enabled = false;
  let log: (msg: string) => void = () => {};

  function create(info: ts.server.PluginCreateInfo): ts.LanguageService {
    log = (msg: string) => {
      try { info.project.projectService.logger.info(`[expanded-types] ${msg}`); } catch {}
    };
    log('plugin loaded, enabled=' + String(enabled));
    const proxy: ts.LanguageService = Object.create(null);
    const ls = info.languageService;

    let proto = Object.getPrototypeOf(ls) as object | null;
    while (proto && proto !== Object.prototype) {
      for (const k of Object.getOwnPropertyNames(proto) as Array<keyof ts.LanguageService>) {
        if ((k as string) !== 'constructor' && typeof (ls as any)[k] === 'function' && !(proxy as any)[k]) {
          (proxy as any)[k] = (...args: any[]) => (ls as any)[k].apply(ls, args);
        }
      }
      proto = Object.getPrototypeOf(proto) as object | null;
    }

    proxy.getQuickInfoAtPosition = (fileName: string, position: number) => {
      let original: ts.QuickInfo | undefined;
      try {
        original = ls.getQuickInfoAtPosition(fileName, position);
      } catch {
        return undefined;
      }
      if (!enabled) return original;

      const program = ls.getProgram();
      if (!program) return original;

      const sourceFile = program.getSourceFile(fileName);
      if (!sourceFile) return original;

      const checker = program.getTypeChecker();
      const node = findNodeAtPosition(sourceFile, position, tsModule);
      if (!node) return original;

      let type: ts.Type;
      try {
        type = checker.getTypeAtLocation(node);
      } catch {
        return original;
      }

      let expanded: string;
      try {
        expanded = expandType(type, checker, tsModule, new Set());
      } catch {
        return original;
      }

      const expandedDoc: ts.SymbolDisplayPart = {
        text: '```typescript\n' + buildCodeContent(original, expanded) + '\n```',
        kind: 'markdown',
      };

      if (!original) {
        return {
          kind: '' as ts.ScriptElementKind,
          kindModifiers: '',
          textSpan: { start: position, length: 1 },
          displayParts: [],
          documentation: [expandedDoc],
          tags: [],
        };
      }

      return {
        ...original,
        documentation: [expandedDoc],
      };
    };

    return proxy;
  }

  function onConfigurationChanged(config: { enabled?: boolean }) {
    log('onConfigurationChanged: ' + JSON.stringify(config));
    if (typeof config.enabled === 'boolean') {
      enabled = config.enabled;
    }
  }

  return { create, onConfigurationChanged };
}

function findNodeAtPosition(
  sourceFile: ts.SourceFile,
  position: number,
  tsModule: typeof ts,
): ts.Node | undefined {
  function find(node: ts.Node): ts.Node | undefined {
    if (position >= node.getStart(sourceFile) && position < node.getEnd()) {
      return tsModule.forEachChild(node, find) ?? node;
    }
    return undefined;
  }
  return find(sourceFile);
}

module.exports = init;
