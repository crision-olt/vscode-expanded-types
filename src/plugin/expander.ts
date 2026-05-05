import type * as ts from 'typescript';

type TsModule = Pick<typeof ts, 'TypeFlags' | 'SymbolFlags'>;

const BUILTIN_NAMES = new Set([
  'Date', 'RegExp', 'Error', 'Promise', 'Array', 'ReadonlyArray',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'ArrayBuffer', 'DataView',
]);

export function expandType(
  type: ts.Type,
  checker: ts.TypeChecker,
  tsModule: TsModule,
  visited: Set<ts.Type>,
): string {
  const { TypeFlags, SymbolFlags } = tsModule;

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
    return type.types.map(t => expandType(t, checker, tsModule, visited)).join(' | ');
  }

  if (type.isIntersection()) {
    return type.types.map(t => expandType(t, checker, tsModule, visited)).join(' & ');
  }

  const symbol = type.getSymbol();
  if (symbol && BUILTIN_NAMES.has(symbol.getName())) {
    return checker.typeToString(type);
  }

  // Guard object expansion against circular references using the type id
  const typeId = (type as ts.Type & { id?: number }).id;
  if (typeId !== undefined && visited.has(type)) {
    return checker.typeToString(type);
  }

  const props = type.getProperties();
  if (props.length > 0) {
    return expandObjectType(type, checker, tsModule, visited, SymbolFlags);
  }

  return checker.typeToString(type);
}

function expandObjectType(
  type: ts.Type,
  checker: ts.TypeChecker,
  tsModule: TsModule,
  visited: Set<ts.Type>,
  SymbolFlags: typeof ts.SymbolFlags,
): string {
  if (visited.has(type)) {
    return checker.typeToString(type);
  }
  visited.add(type);

  const props = type.getProperties();
  const parts = props.map(prop => {
    const isOptional = !!(prop.flags & SymbolFlags.Optional);
    let propType = checker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration!);
    // Strip the implicit `undefined` that TypeScript adds to optional properties
    if (isOptional && propType.isUnion()) {
      const { TypeFlags } = tsModule;
      const nonUndefinedTypes = propType.types.filter(t => !(t.flags & TypeFlags.Undefined));
      if (nonUndefinedTypes.length === 1) {
        propType = nonUndefinedTypes[0];
      }
    }
    const expanded = expandType(propType, checker, tsModule, visited);
    return `${prop.getName()}${isOptional ? '?' : ''}: ${expanded}`;
  });

  visited.delete(type);
  return `{ ${parts.join('; ')} }`;
}
