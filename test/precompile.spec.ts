import { expect } from "chai";
import { Project, FunctionDeclaration, ClassDeclaration } from "ts-morph";
import {
  getCustomDeclarationsMap,
  isAugmented,
  isFunction,
  augmentFunction,
  mergeAndReplace,
  mergeModuleDeclarations,
  mergeClasses,
} from "../scripts/precompile";

// Helper function to create a ts-morph Project with in-memory source files
function createProjectWithFiles(files: Record<string, string>): Project {
  const project = new Project();
  for (const [fileName, content] of Object.entries(files)) {
    project.createSourceFile(fileName, content);
  }
  return project;
}

describe("mergeDeclarations", () => {
  describe("getCustomDeclarationsMap", () => {
    it("should create a custom declarations map from a source file", () => {
      const project = createProjectWithFiles({
        "custom.ts": `
          export function foo() {}
          export class Bar {}
          export interface Baz {}
          export type Quux = string | number;
        `,
      });

      const sourceFile = project.getSourceFileOrThrow("custom.ts");
      const customDeclarationsMap = getCustomDeclarationsMap(sourceFile);

      expect(customDeclarationsMap.functions.get("foo")).to.be.instanceOf(
        FunctionDeclaration
      );
      expect(customDeclarationsMap.classes.get("Bar")).to.exist;
      expect(customDeclarationsMap.interfaces.get("Baz")).to.exist;
      expect(customDeclarationsMap.typeAliases.get("Quux")).to.exist;
    });
  });

  describe("isAugmented", () => {
    it("should return true if the custom function is augmenting the original", () => {
      const project = createProjectWithFiles({
        "custom.ts": `
      import { foo as _foo } from "./generated/foo";

      export function foo() {
        _foo();
      }
    `,
      });

      const customFunction = project
        .getSourceFileOrThrow("custom.ts")
        .getFunctionOrThrow("foo");
      expect(isAugmented(customFunction)).to.be.true;
    });

    it("should return false if the custom function is not augmented", () => {
      const project = createProjectWithFiles({
        "custom.ts": `
      export function foo() {}
    `,
      });

      const customFunction = project
        .getSourceFileOrThrow("custom.ts")
        .getFunctionOrThrow("foo");
      expect(isAugmented(customFunction)).to.be.false;
    });
  });

  describe("isFunction", () => {
    it("should return true if the declaration is a function", () => {
      const project = createProjectWithFiles({
        "test.ts": `
          export function foo() {}
        `,
      });
      const declaration = project
        .getSourceFileOrThrow("test.ts")
        .getFunctionOrThrow("foo");
      expect(isFunction(declaration)).to.be.true;
    });

    it("should return false if the declaration is not a function", () => {
      const project = createProjectWithFiles({
        "test.ts": `
          export class Bar {}
        `,
      });

      const declaration = project
        .getSourceFileOrThrow("test.ts")
        .getClassOrThrow("Bar");
      expect(isFunction(declaration)).to.be.false;
    });
  });

  describe("augmentFunction", () => {
    it("should augment a function", () => {
      const project = createProjectWithFiles({
        "out.ts": `
          export function foo() {}
        `,
        "custom.ts": `
          import { foo as _foo } from "./out";
    
          export function foo() {
            _foo();
          }
        `,
      });

      const outFunction = project
        .getSourceFileOrThrow("out.ts")
        .getFunctionOrThrow("foo");
      const customFunction = project
        .getSourceFileOrThrow("custom.ts")
        .getFunctionOrThrow("foo");

      augmentFunction(outFunction, customFunction);

      expect(outFunction.isExported()).to.be.false;
      expect(outFunction.getName()).to.equal("_foo");
      expect(customFunction.getSourceFile().getFunction("foo")).to.exist;
    });

    it("should augment a function with overloads", () => {
      const project = createProjectWithFiles({
        "out.ts": `
          export function foo(id: string) {}
        `,
        "custom.ts": `
          import { foo as _foo } from "./out";
    
          export function foo(id: string): void;
          export function foo(id: string[]): void;
          export function foo(id: string[] | string): void {
            let input = id;
            if (Array.isArray(id)) {
              input = id.join(",");
            }

            _foo(input);
          }
        `,
      });

      const outFunction = project
        .getSourceFileOrThrow("out.ts")
        .getFunctionOrThrow("foo");
      const customFunction = project
        .getSourceFileOrThrow("custom.ts")
        .getFunctionOrThrow("foo");

      augmentFunction(outFunction, customFunction);

      expect(outFunction.isExported()).to.be.false;
      expect(outFunction.getName()).to.equal("_foo");
      expect(customFunction.getOverloads().length).to.equal(2);
      expect(
        customFunction.getOverloads()[0].getParameters()[0].getType().getText()
      ).to.equal("string");
      expect(
        customFunction.getOverloads()[1].getParameters()[0].getType().getText()
      ).to.equal("string[]");
      expect(customFunction.getSourceFile().getFunction("foo")).to.exist;
    });

    it("should augment a function with overloads", () => {
      const project = createProjectWithFiles({
        "out.ts": `
        export function foo(id: string): void;
        export function foo(id: string[]): void;
        export function foo(id: string[] | string): void {
          console.log(id);
        }
        `,
        "custom.ts": `
          import { foo as _foo } from "./out";
    
          export function foo(id: number): void;
          export function foo(id: number[]): void;
          export function foo(id: number[] | number): void {
            let input: string | string[] = id.toString();
            if (Array.isArray(id)) {
              input = id.map((i) => i.toString()).join(",");
            }

            _foo(input);
          }
        `,
      });

      const outFunction = project
        .getSourceFileOrThrow("out.ts")
        .getFunctionOrThrow("foo");
      const customFunction = project
        .getSourceFileOrThrow("custom.ts")
        .getFunctionOrThrow("foo");

      augmentFunction(outFunction, customFunction);

      expect(outFunction.isExported()).to.be.false;
      expect(outFunction.getName()).to.equal("_foo");
      expect(outFunction.getOverloads().length).to.equal(2);
      expect(outFunction.getOverloads()[0].getName()).to.equal("_foo");
      expect(
        outFunction.getOverloads()[0].getParameters()[0].getType().getText()
      ).to.equal("string");
      expect(outFunction.getOverloads()[1].getName()).to.equal("_foo");
      expect(
        outFunction.getOverloads()[1].getParameters()[0].getType().getText()
      ).to.equal("string[]");
      expect(customFunction.getOverloads().length).to.equal(2);
      expect(customFunction.getOverloads()[0].getName()).to.equal("foo");
      expect(customFunction.getOverloads()[1].getName()).to.equal("foo");
      expect(
        customFunction.getOverloads()[0].getParameters()[0].getType().getText()
      ).to.equal("number");
      expect(
        customFunction.getOverloads()[1].getParameters()[0].getType().getText()
      ).to.equal("number[]");
      expect(customFunction.getSourceFile().getFunction("foo")).to.exist;
    });
  });

  describe("mergeAndReplace", () => {
    it("should merge and replace declarations", () => {
      const project = createProjectWithFiles({
        "out.ts": `
          export function foo() {}
          export class Bar {}
        `,
        "custom.ts": `
          export function foo() { console.log("Custom foo"); }
          export class Bar { customMethod() {} }
        `,
      });

      const outSourceFile = project.getSourceFileOrThrow("out.ts");
      const customSourceFile = project.getSourceFileOrThrow("custom.ts");
      const customDeclarationsMap = getCustomDeclarationsMap(customSourceFile);

      mergeAndReplace(
        customDeclarationsMap.functions,
        outSourceFile.getFunctions()
      );
      mergeAndReplace(
        customDeclarationsMap.classes,
        outSourceFile.getClasses()
      );

      expect(outSourceFile.getFunctionOrThrow("foo").getText()).to.equal(
        customSourceFile.getFunctionOrThrow("foo").getText()
      );
      expect(outSourceFile.getClassOrThrow("Bar").getText()).to.equal(
        customSourceFile.getClassOrThrow("Bar").getText()
      );
    });
  });

  describe("mergeModuleDeclarations", () => {
    it("should merge module declarations", () => {
      const customContent = `
        export function foo() { console.log("Custom foo"); }
        export class Bar { customMethod() {} }
      `;
      const outContent = `
        export function foo() {}
        export class Bar {}
      `;

      const mergedContent = mergeModuleDeclarations(customContent, outContent);
      const project = createProjectWithFiles({ "merged.ts": mergedContent });

      const mergedSourceFile = project.getSourceFileOrThrow("merged.ts");

      expect(mergedSourceFile.getFunctionOrThrow("foo").getText()).to.contain(
        "Custom foo"
      );
      expect(mergedSourceFile.getClassOrThrow("Bar").getMethod("customMethod"))
        .to.exist;
    });
  });

  describe("mergeClasses", () => {

    function createClass(source: string): ClassDeclaration {
      const project = new Project();
      const sourceFile = project.createSourceFile("temp.ts", source);
      const classDeclaration = sourceFile.getClasses()[0];
      // project.removeSourceFile(sourceFile);
      return classDeclaration;
    }

    it("should merge unique properties and methods from custom and generated classes", () => {
      const customClass = createClass(`
  class MyClass {
    customProp: string;
    customMethod() {}
  }
  `);
      const generatedClass = createClass(`
  class MyClass {
    generatedProp: number;
    generatedMethod() {}
  }
  `);

      mergeClasses(new Map([["MyClass", customClass]]), [generatedClass]);

      expect(generatedClass.getProperty("customProp")).to.exist;
      expect(generatedClass.getProperty("generatedProp")).to.exist;
      expect(generatedClass.getMethod("customMethod")).to.exist;
      expect(generatedClass.getMethod("generatedMethod")).to.exist;
    });

    it("should replace properties and methods with the same name from the custom class", () => {
      const customClass = createClass(`
  class MyClass {
    prop: string;
    method() { return "custom"; }
  }
  `);
      const generatedClass = createClass(`
  class MyClass {
    prop: number;
    method() { return "generated"; }
  }
  `);

      mergeClasses(new Map([["MyClass", customClass]]), [generatedClass]);

      const prop = generatedClass.getProperty("prop");
      expect(prop).to.exist;
      expect(prop?.getType().getText()).to.equal("string");

      const method = generatedClass.getMethod("method");
      expect(method).to.exist;
      expect(method?.getBodyText()).to.include('return "custom"');
    });

    // Add more test cases here
  });
});
