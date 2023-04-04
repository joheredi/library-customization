import { expect } from "chai";
import { mergeModuleDeclarations } from "../scripts/precompile";

describe("mergeModuleDeclarations", () => {
  it("should merge functions", () => {
    const customContent = `export function foo() { return "custom foo"; }`;
    const outContent = `export function foo() { return "original foo"; }`;
    const expectedContent = `export function foo() { return "custom foo"; }`;
    const mergedContent = mergeModuleDeclarations(customContent, outContent);
    expect(mergedContent).to.equal(expectedContent);
  });

  it("should merge classes", () => {
    const customContent = `export class Foo { bar() { return "custom bar"; } }`;
    const outContent = `export class Foo { bar() { return "original bar"; } baz() { return "original baz"; } }`;
    const expectedContent = `export class Foo { bar() { return "custom bar"; } baz() { return "original baz"; } }`;
    const mergedContent = mergeModuleDeclarations(customContent, outContent);
    expect(mergedContent).to.equal(expectedContent);
  });

  it("should merge interfaces", () => {
    const customContent = `export interface MyInterface { foo: string }`;
    const outContent = `export interface MyInterface { bar: string }`;
    const expectedContent = `export interface MyInterface { foo: string; bar: string }`;
    const mergedContent = mergeModuleDeclarations(customContent, outContent);
    expect(mergedContent).to.equal(expectedContent);
  });

  it("should not merge non-matching functions", () => {
    const customContent = `export function foo() { return "custom foo"; }`;
    const outContent = `export function bar() { return "original bar"; }`;
    const expectedContent = `${outContent}\n${customContent}`;
    const mergedContent = mergeModuleDeclarations(customContent, outContent);
    expect(mergedContent).to.equal(expectedContent);
  });

  it("should not merge non-matching classes", () => {
    const customContent = `export class Foo { bar() { return "custom bar"; } }`;
    const outContent = `export class Bar { baz() { return "original baz"; } }`;
    const expectedContent = `${outContent}\n${customContent}`;
    const mergedContent = mergeModuleDeclarations(customContent, outContent);
    expect(mergedContent).to.equal(expectedContent);
  });

  it("should not merge non-matching interfaces", () => {
    const customContent = `export interface MyInterface { foo: string }`;
    const outContent = `export interface YourInterface { bar: string }`;
    const expectedContent = `${outContent}\n${customContent}`;
    const mergedContent = mergeModuleDeclarations(customContent, outContent);
    expect(mergedContent).to.equal(expectedContent);
  });
});