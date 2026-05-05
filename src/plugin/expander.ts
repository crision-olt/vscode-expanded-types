import type * as ts from 'typescript';

type TsModule = Pick<typeof ts, 'TypeFlags' | 'SymbolFlags'>;

const BUILTIN_NAMES = new Set([
  'Date', 'RegExp', 'Error', 'Promise', 'Array', 'ReadonlyArray',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'ArrayBuffer', 'DataView',
]);

const INDENT = '  ';

export function expandType(
  type: ts.Type,
  checker: ts.TypeChecker,
  tsModule: TsModule,
  visited: Set<ts.Type>,
  depth = 0,
): string {
  const { TypeFlags } = tsModule;

  if (type.flags & TypeFlags.String) return 'string';
  if (type.flags & TypeFlags.Number) return 'number';
  if (type.flags & TypeFlags.Boolean) return 'boolean';
  if (type.flags & TypeFlags.Null) return 'null';
  if (type.flags & TypeFlags.Undefined) return 'undefined';
  if (type.flags & TypeFlags.Void) return 'void';
  if (type.flags & TypeFlags.Never) return 'never';
  if (type.flags & TypeFlags.Any) return 'any';
  if (type.flags & TypeFlags.Unknown) return 'unknown';
  if (type.flags & TypeFlags.BigInt) return 'bigint';

  if (type.isStringLiteral()) return JSON.stringify(type.value);
  if (type.isNumberLiteral()) return String(type.value);
  if (type.flags & TypeFlags.BooleanLiteral) return checker.typeToString(type);
  if (type.flags & TypeFlags.BigIntLiteral) return checker.typeToString(type);

  if (type.isUnion()) {
    const { TypeFlags } = tsModule;
    const isNullish = (t: ts.Type) => !!(t.flags & (TypeFlags.Null | TypeFlags.Undefined));
    const sorted = [...type.types].sort((a, b) => {
      if (isNullish(a) && !isNullish(b)) return 1;
      if (!isNullish(a) && isNullish(b)) return -1;
      return 0;
    });
    const parts = sorted.map(t => expandType(t, checker, tsModule, visited, depth));
    const hasObjects = parts.some(p => p.startsWith('{'));
    if (hasObjects) {
      const pad = INDENT.repeat(depth);
      return parts.join(`\n${pad}| `);
    }
    return parts.join(' | ');
  }

  if (type.isIntersection()) {
    if (type.getProperties().length > 0) {
      return expandObjectType(type, checker, tsModule, visited, depth);
    }
    const parts = type.types.map(t => expandType(t, checker, tsModule, visited, depth));
    return parts.join(' & ');
  }

  // Expand array element types recursively instead of falling back to typeToString.
  if (checker.isArrayType(type)) {
    const args = checker.getTypeArguments(type as ts.TypeReference);
    if (args.length > 0) {
      const elem = expandType(args[0], checker, tsModule, visited, depth);
      return elem.includes(' | ') ? `(${elem})[]` : `${elem}[]`;
    }
  }
  if ((checker as any).isReadonlyArrayType?.(type)) {
    const args = checker.getTypeArguments(type as ts.TypeReference);
    if (args.length > 0) {
      const elem = expandType(args[0], checker, tsModule, visited, depth);
      return elem.includes(' | ') ? `readonly (${elem})[]` : `readonly ${elem}[]`;
    }
  }

  const symbol = type.getSymbol();
  if (symbol && BUILTIN_NAMES.has(symbol.getName())) {
    return checker.typeToString(type);
  }

  const callSigs = type.getCallSignatures();
  if (callSigs.length > 0 && type.getProperties().length === 0) {
    return callSigs.map(sig => expandSignature(sig, checker, tsModule, visited, depth)).join(' | ');
  }

  const props = type.getProperties();
  if (props.length > 0) {
    return expandObjectType(type, checker, tsModule, visited, depth);
  }

  return checker.typeToString(type);
}

function expandSignature(
  sig: ts.Signature,
  checker: ts.TypeChecker,
  tsModule: TsModule,
  visited: Set<ts.Type>,
  depth: number,
): string {
  const params = sig.getParameters().map(p => {
    const node = p.valueDeclaration ?? p.declarations?.[0];
    const t = node ? checker.getTypeOfSymbolAtLocation(p, node) : checker.getTypeOfSymbol(p);
    return `${p.getName()}: ${expandType(t, checker, tsModule, visited, depth)}`;
  });
  const ret = expandType(checker.getReturnTypeOfSignature(sig), checker, tsModule, visited, depth);
  return `(${params.join(', ')}) => ${ret}`;
}

function expandObjectType(
  type: ts.Type,
  checker: ts.TypeChecker,
  tsModule: TsModule,
  visited: Set<ts.Type>,
  depth: number,
): string {
  if (visited.has(type)) {
    return checker.typeToString(type);
  }
  visited.add(type);

  const { SymbolFlags, TypeFlags } = tsModule;
  const indent = INDENT.repeat(depth + 1);
  const closingIndent = INDENT.repeat(depth);

  const props = type.getProperties();
  const parts = props.map(prop => {
    const isOptional = !!(prop.flags & SymbolFlags.Optional);
    const node = prop.valueDeclaration ?? prop.declarations?.[0];
    let propType = node
      ? checker.getTypeOfSymbolAtLocation(prop, node)
      : checker.getTypeOfSymbol(prop);

    if (isOptional && propType.isUnion()) {
      const nonUndefined = propType.types.filter(t => !(t.flags & TypeFlags.Undefined));
      if (nonUndefined.length === 1) {
        propType = nonUndefined[0];
      } else if (nonUndefined.length > 1) {
        const sortedParts = [...nonUndefined].sort((a, b) => {
          const aN = !!(a.flags & TypeFlags.Null);
          const bN = !!(b.flags & TypeFlags.Null);
          return aN === bN ? 0 : aN ? 1 : -1;
        });
        const expanded = sortedParts.map(t => expandType(t, checker, tsModule, visited, depth + 1)).join(' | ');
        return `${indent}${prop.getName()}?: ${expanded}`;
      }
    }

    const expanded = expandType(propType, checker, tsModule, visited, depth + 1);
    return `${indent}${prop.getName()}${isOptional ? '?' : ''}: ${expanded}`;
  });

  visited.delete(type);

  if (parts.length === 0) return '{}';
  return `{\n${parts.join(';\n')};\n${closingIndent}}`;
}
