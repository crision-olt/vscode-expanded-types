import { describe, it, expect } from 'vitest';
import * as ts from 'typescript';
import { expandType } from '../src/plugin/expander';

function getTypeFromDecl(code: string): { type: ts.Type; checker: ts.TypeChecker } {
  const filename = '/virtual/test.ts';
  const sourceFile = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true);
  const defaultHost = ts.createCompilerHost({});
  const host: ts.CompilerHost = {
    ...defaultHost,
    getSourceFile: (name, version) =>
      name === filename ? sourceFile : defaultHost.getSourceFile(name, version),
    fileExists: (name) => name === filename || defaultHost.fileExists(name),
    readFile: (name) => (name === filename ? code : defaultHost.readFile(name)),
  };
  const program = ts.createProgram([filename], { strict: true, skipLibCheck: true, noLib: true }, host);
  const checker = program.getTypeChecker();
  const sf = program.getSourceFile(filename)!;
  const stmt = sf.statements[0] as ts.VariableStatement;
  const decl = stmt.declarationList.declarations[0];
  return { type: checker.getTypeAtLocation(decl), checker };
}

function getTypeFromMultiDecl(code: string, stmtIndex: number): { type: ts.Type; checker: ts.TypeChecker } {
  const filename = '/virtual/test.ts';
  const sourceFile = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true);
  const defaultHost = ts.createCompilerHost({});
  const host: ts.CompilerHost = {
    ...defaultHost,
    getSourceFile: (name, version) =>
      name === filename ? sourceFile : defaultHost.getSourceFile(name, version),
    fileExists: (name) => name === filename || defaultHost.fileExists(name),
    readFile: (name) => (name === filename ? code : defaultHost.readFile(name)),
  };
  const program = ts.createProgram([filename], { strict: true, skipLibCheck: true, noLib: true }, host);
  const checker = program.getTypeChecker();
  const sf = program.getSourceFile(filename)!;
  const stmt = sf.statements[stmtIndex] as ts.VariableStatement;
  const decl = stmt.declarationList.declarations[0];
  return { type: checker.getTypeAtLocation(decl), checker };
}

function getTypeWithLib(code: string, stmtIndex: number): { type: ts.Type; checker: ts.TypeChecker } {
  const filename = '/virtual/test.ts';
  const sourceFile = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true);
  const defaultHost = ts.createCompilerHost({});
  const host: ts.CompilerHost = {
    ...defaultHost,
    getSourceFile: (name, version) =>
      name === filename ? sourceFile : defaultHost.getSourceFile(name, version),
    fileExists: (name) => name === filename || defaultHost.fileExists(name),
    readFile: (name) => (name === filename ? code : defaultHost.readFile(name)),
  };
  const program = ts.createProgram([filename], { strict: true, skipLibCheck: true }, host);
  const checker = program.getTypeChecker();
  const sf = program.getSourceFile(filename)!;
  const stmt = sf.statements[stmtIndex] as ts.VariableStatement;
  const decl = stmt.declarationList.declarations[0];
  return { type: checker.getTypeAtLocation(decl), checker };
}

describe('expandType', () => {
  it('expands string primitive', () => {
    const { type, checker } = getTypeFromDecl('const x: string = "";');
    expect(expandType(type, checker, ts)).toBe('string');
  });

  it('expands number primitive', () => {
    const { type, checker } = getTypeFromDecl('const x: number = 0;');
    expect(expandType(type, checker, ts)).toBe('number');
  });

  it('expands boolean primitive', () => {
    const { type, checker } = getTypeFromDecl('const x: boolean = true;');
    expect(expandType(type, checker, ts)).toBe('boolean');
  });

  it('expands null', () => {
    const { type, checker } = getTypeFromDecl('const x: null = null;');
    expect(expandType(type, checker, ts)).toBe('null');
  });

  it('expands undefined', () => {
    const { type, checker } = getTypeFromDecl('const x: undefined = undefined;');
    expect(expandType(type, checker, ts)).toBe('undefined');
  });

  it('expands string literal', () => {
    const { type, checker } = getTypeFromDecl('const x: "hello" = "hello";');
    expect(expandType(type, checker, ts)).toBe('"hello"');
  });

  it('expands number literal', () => {
    const { type, checker } = getTypeFromDecl('const x: 42 = 42;');
    expect(expandType(type, checker, ts)).toBe('42');
  });

  it('expands flat object type', () => {
    const { type, checker } = getTypeFromDecl('const x: { a: string; b: number } = { a: "", b: 0 };');
    expect(expandType(type, checker, ts)).toBe('{\n  a: string;\n  b: number;\n}');
  });

  it('expands nested object type', () => {
    const { type, checker } = getTypeFromDecl('const x: { a: { b: string } } = { a: { b: "" } };');
    expect(expandType(type, checker, ts)).toBe('{\n  a: {\n    b: string;\n  };\n}');
  });

  it('expands object with optional property', () => {
    const { type, checker } = getTypeFromDecl('const x: { a?: string } = {};');
    expect(expandType(type, checker, ts)).toBe('{\n  a?: string;\n}');
  });

  it('expands union of primitives', () => {
    const { type, checker } = getTypeFromDecl('const x: string | number = "";');
    const result = expandType(type, checker, ts);
    expect(result).toBe('string | number');
  });

  it('expands union with object', () => {
    const { type, checker } = getTypeFromDecl('const x: string | { a: number } = "";');
    const result = expandType(type, checker, ts);
    expect(result).toBe('string\n| {\n  a: number;\n}');
  });

  it('expands named interface references deeply', () => {
    const code = `
      interface Inner { b: string; c: number; }
      interface Outer { a: Inner; }
      const x: Outer = { a: { b: '', c: 0 } };
    `;
    const { type, checker } = getTypeFromMultiDecl(code, 2);
    const result = expandType(type, checker, ts);
    expect(result).toBe('{\n  a: {\n    b: string;\n    c: number;\n  };\n}');
  });

  it('expands generic type instantiation', () => {
    const code = `
      interface Inner { b: string; c: number; }
      interface Wrapper<T> { value: T; count: number; }
      const x: Wrapper<Inner> = { value: { b: '', c: 0 }, count: 1 };
    `;
    const { type, checker } = getTypeFromMultiDecl(code, 2);
    const result = expandType(type, checker, ts);
    // value: T should expand to { b: string; c: number }, not show as "T" or "Inner"
    expect(result).toContain('b: string');
    expect(result).toContain('c: number');
  });

  it('merges object intersection into flat object', () => {
    const { type, checker } = getTypeFromDecl('const x: { a: string } & { b: number } = { a: "", b: 0 };');
    const result = expandType(type, checker, ts);
    expect(result).toBe('{\n  a: string;\n  b: number;\n}');
  });

  it('expands array of named type', () => {
    const code = `
      interface Item { id: number; name: string; }
      const x: Item[] = [];
    `;
    const { type, checker } = getTypeFromMultiDecl(code, 1);
    const result = expandType(type, checker, ts);
    expect(result).toBe('{\n  id: number;\n  name: string;\n}[]');
  });

  it('handles circular reference gracefully', () => {
    const code = `
      type Node = { value: string; next: Node | null };
      const x: Node = { value: "", next: null };
    `;
    const { type, checker } = getTypeFromMultiDecl(code, 1);
    const result = expandType(type, checker, ts);
    expect(result).toContain('value: string');
  });

  it('cuts off expansion at maxDepth and uses typeToString fallback', () => {
    const { type, checker } = getTypeFromDecl(
      'const x: { a: { b: { c: { d: string } } } } = { a: { b: { c: { d: "" } } } };',
    );
    // maxDepth=2: outer object is depth 0, `a` prop is depth 1, `b` prop is depth 2, `c` should NOT expand inline
    const result = expandType(type, checker, ts, 2);
    expect(result).toContain('a:');
    expect(result).toContain('b:');
    expect(result).not.toMatch(/c:\s*\{/);
  });

  it('does not wrap object array element in parens when object has union-typed properties', () => {
    const code = `
      interface Item { id: number | null; name: string | null; }
      const x: Item[] = [];
    `;
    const { type, checker } = getTypeFromMultiDecl(code, 1);
    const result = expandType(type, checker, ts);
    expect(result).not.toMatch(/^\(/);
    expect(result).toMatch(/^\{/);
    expect(result).toMatch(/\}\[\]$/);
  });

  it('expands simple tuple', () => {
    const { type, checker } = getTypeFromDecl('const x: [string, number] = ["", 0];');
    const result = expandType(type, checker, ts);
    expect(result).toBe('[string, number]');
  });

  it('expands tuple with named interface element', () => {
    const code = `
      interface Item { id: number; name: string; }
      const x: [string, Item] = ["", { id: 0, name: "" }];
    `;
    const { type, checker } = getTypeFromMultiDecl(code, 1);
    const result = expandType(type, checker, ts);
    expect(result).toContain('[string,');
    expect(result).toContain('id: number');
  });

  it('expands Omit utility type to concrete properties', () => {
    const code = `
      interface Item { id: number; name: string; description: string; }
      const x: Omit<Item, "id"> = { name: "", description: "" };
    `;
    const { type, checker } = getTypeWithLib(code, 1);
    const result = expandType(type, checker, ts);
    expect(result).toContain('name: string');
    expect(result).toContain('description: string');
    expect(result).not.toContain('id:');
    expect(result).not.toContain('Omit<');
  });

  it('expands array of Omit utility type without parens', () => {
    const code = `
      interface Item { id: number; name: string; }
      const x: Omit<Item, "id">[] = [];
    `;
    const { type, checker } = getTypeWithLib(code, 1);
    const result = expandType(type, checker, ts);
    expect(result).not.toMatch(/^\(/);
    expect(result).toContain('name: string');
    expect(result).toMatch(/\}\[\]$/);
    expect(result).not.toContain('Omit<');
  });

  it('does not wrap non-union element in parens for generic utility type arrays', () => {
    const code = `
      interface Item { id: number; name: string; tags: string | null; }
      const x: Omit<Item, "id">[] = [];
    `;
    const { type, checker } = getTypeWithLib(code, 1);
    const result = expandType(type, checker, ts);
    expect(result).not.toMatch(/^\(/);
    expect(result).toMatch(/\}\[\]$/);
  });
});
