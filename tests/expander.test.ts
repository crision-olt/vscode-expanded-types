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

describe('expandType', () => {
  it('expands string primitive', () => {
    const { type, checker } = getTypeFromDecl('const x: string = "";');
    expect(expandType(type, checker, ts, new Set())).toBe('string');
  });

  it('expands number primitive', () => {
    const { type, checker } = getTypeFromDecl('const x: number = 0;');
    expect(expandType(type, checker, ts, new Set())).toBe('number');
  });

  it('expands boolean primitive', () => {
    const { type, checker } = getTypeFromDecl('const x: boolean = true;');
    expect(expandType(type, checker, ts, new Set())).toBe('boolean');
  });

  it('expands null', () => {
    const { type, checker } = getTypeFromDecl('const x: null = null;');
    expect(expandType(type, checker, ts, new Set())).toBe('null');
  });

  it('expands undefined', () => {
    const { type, checker } = getTypeFromDecl('const x: undefined = undefined;');
    expect(expandType(type, checker, ts, new Set())).toBe('undefined');
  });

  it('expands string literal', () => {
    const { type, checker } = getTypeFromDecl('const x: "hello" = "hello";');
    expect(expandType(type, checker, ts, new Set())).toBe('"hello"');
  });

  it('expands number literal', () => {
    const { type, checker } = getTypeFromDecl('const x: 42 = 42;');
    expect(expandType(type, checker, ts, new Set())).toBe('42');
  });

  it('expands flat object type', () => {
    const { type, checker } = getTypeFromDecl('const x: { a: string; b: number } = { a: "", b: 0 };');
    expect(expandType(type, checker, ts, new Set())).toBe('{ a: string; b: number }');
  });

  it('expands nested object type', () => {
    const { type, checker } = getTypeFromDecl('const x: { a: { b: string } } = { a: { b: "" } };');
    expect(expandType(type, checker, ts, new Set())).toBe('{ a: { b: string } }');
  });

  it('expands object with optional property', () => {
    const { type, checker } = getTypeFromDecl('const x: { a?: string } = {};');
    expect(expandType(type, checker, ts, new Set())).toBe('{ a?: string }');
  });

  it('expands union of primitives', () => {
    const { type, checker } = getTypeFromDecl('const x: string | number = "";');
    const result = expandType(type, checker, ts, new Set());
    expect(result).toBe('string | number');
  });

  it('expands union with object', () => {
    const { type, checker } = getTypeFromDecl('const x: string | { a: number } = "";');
    const result = expandType(type, checker, ts, new Set());
    expect(result).toBe('string | { a: number }');
  });

  it('handles circular reference gracefully', () => {
    const code = `
      type Node = { value: string; next: Node | null };
      const x: Node = { value: "", next: null };
    `;
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
    const stmt = sf.statements[1] as ts.VariableStatement;
    const decl = stmt.declarationList.declarations[0];
    const type = checker.getTypeAtLocation(decl);
    const result = expandType(type, checker, ts, new Set());
    expect(result).toContain('value: string');
    expect(result).not.toThrow;
  });
});
