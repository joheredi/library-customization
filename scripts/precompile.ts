import * as fs from "fs-extra";
import * as path from "path";
import {
  Project,
  FunctionDeclaration,
  ClassDeclaration,
  InterfaceDeclaration,
  TypeAliasDeclaration,
  SourceFile,
  SyntaxKind,
  MethodDeclarationStructure,
  Scope,
} from "ts-morph";

export async function main() {
  // Copy the entire src folder to the out folder
  const originalDir = process.argv[2] ?? "./generated" // generated
  const customDir = process.argv[3] ?? "./custom" // custom
  const outDir = process.argv[4] ?? "./src"; // out
  if (!originalDir || !customDir) {
    throw new Error(
      "the first two arguments must be the generated and custom directories"
    );
  }

  // Bring everything from original into the output
  await fs.copy(originalDir, outDir);

  // Merge the module declarations for all files in the custom directory and its subdirectories
  await processDirectory(customDir, outDir);
}

type Declaration =
  | FunctionDeclaration
  | ClassDeclaration
  | InterfaceDeclaration
  | TypeAliasDeclaration;

type CustomDeclarationsMap = {
  functions: Map<string, FunctionDeclaration>;
  classes: Map<string, ClassDeclaration>;
  interfaces: Map<string, InterfaceDeclaration>;
  typeAliases: Map<string, TypeAliasDeclaration>;
};

export async function readFileContent(filepath: string): Promise<string> {
  return fs.readFile(filepath, "utf8");
}

export async function writeFileContent(
  filepath: string,
  content: string
): Promise<void> {
  return fs.writeFile(filepath, content);
}

export function getCustomDeclarationsMap(
  sourceFile: SourceFile
): CustomDeclarationsMap {
  const customDeclarationsMap: CustomDeclarationsMap = {
    functions: new Map<string, FunctionDeclaration>(),
    classes: new Map<string, ClassDeclaration>(),
    interfaces: new Map<string, InterfaceDeclaration>(),
    typeAliases: new Map<string, TypeAliasDeclaration>(),
  };

  // Collect custom declarations
  for (const customFunction of sourceFile.getFunctions()) {
    const functionName = customFunction.getName();
    if (!functionName) {
      // skip anonymous functions
      continue;
    }
    customDeclarationsMap.functions.set(functionName, customFunction);
  }
  for (const customClass of sourceFile.getClasses()) {
    const className = customClass.getName();
    if (!className) {
      // skip anonymous classes
      continue;
    }
    customDeclarationsMap.classes.set(className, customClass);
  }
  for (const customInterface of sourceFile.getInterfaces()) {
    customDeclarationsMap.interfaces.set(
      customInterface.getName(),
      customInterface
    );
  }
  for (const customTypeAlias of sourceFile.getTypeAliases()) {
    customDeclarationsMap.typeAliases.set(
      customTypeAlias.getName(),
      customTypeAlias
    );
  }

  return customDeclarationsMap;
}

function removeTsIgnore(content: string): string {
  const tsIgnorePattern = /\/\/\s*@ts-ignore/g;
  return content.replace(tsIgnorePattern, "");
}

export async function processFile(
  customFilePath: string,
  originalFilePath: string
): Promise<void> {
  const customContent = await readFileContent(customFilePath);
  const originalContent = await readFileContent(originalFilePath);

  const mergedContent = mergeModuleDeclarations(customContent, originalContent);
  const cleanedContent = removeTsIgnore(mergedContent);

  await writeFileContent(originalFilePath, cleanedContent);
}

export async function processDirectory(
  customDir: string,
  originalDir: string
): Promise<void> {
  // Note: the originalDir is in reality the output directory but for readability we call it originalDir
  // since we copied over eveything from the original directory to the output directory avoid
  // overwriting the original files.
  const entries = await fs.readdir(customDir, { withFileTypes: true });

  for (const entry of entries) {
    const customPath = path.join(customDir, entry.name);
    const originalPath = path.join(originalDir, entry.name);

    if (entry.isFile() && path.extname(entry.name) === ".ts") {
      await processFile(customPath, originalPath);
    } else if (entry.isDirectory()) {
      const subCustomDir = path.join(customDir, entry.name);
      const subOutDir = path.join(originalDir, entry.name);
      await fs.ensureDir(subOutDir);
      await processDirectory(subCustomDir, subOutDir);
    }
  }
}

export function isAugmented(customFunction: FunctionDeclaration): boolean {
  const imports = customFunction.getSourceFile().getImportDeclarations();
  for (const importDeclaration of imports) {
    const namedImports = importDeclaration.getNamedImports();
    for (const namedImport of namedImports) {
      if (
        namedImport.getName() === `${customFunction.getName()}` &&
        importDeclaration.getModuleSpecifierValue().includes("/generated/")
      ) {
        return true;
      }
    }
  }
  return false;
}

export function isFunction(
  declaration: Declaration
): declaration is FunctionDeclaration {
  return declaration.getKind() === SyntaxKind.FunctionDeclaration;
}

export function augmentFunction(
  outDeclaration: FunctionDeclaration,
  customDeclaration: FunctionDeclaration
): void {
  const name = outDeclaration.getName() ?? "";
  const overloads = outDeclaration.getOverloads();
  for (const overload of [...overloads, outDeclaration]) {
    overload.setIsExported(false);
    overload.rename(`_${name}`);
  }
  for (const overload of (
    customDeclaration as FunctionDeclaration
  ).getOverloads()) {
    outDeclaration.getSourceFile().addStatements(overload.getText());
  }
  outDeclaration.getSourceFile().addStatements(customDeclaration.getText());
}

export function mergeClasses(
  customClasses: Map<string, ClassDeclaration>,
  originalClasses: ClassDeclaration[]
) {
  for (const originalClass of originalClasses) {
    const name = originalClass.getName();
    const customClass = name ? customClasses.get(name) : undefined;
    if (customClass) {
      // Copy properties from the generated class to the custom class if they don't exist in custom class
      for (const originalProperty of originalClass.getProperties()) {
        const propertyName = originalProperty.getName();
        if (!customClass.getProperty(propertyName)) {
          customClass.addProperty(originalProperty.getStructure());
        }
      }

      // Merge constructor overloads, properties, and methods
      const customConstructors = customClass.getConstructors();
      if (customConstructors.length) {
        const outConstructors = originalClass.getConstructors();
        if (outConstructors.length) {
          outConstructors[0].replaceWithText(customConstructors[0].getText());
          customConstructors.shift();
        }
        for (const customConstructor of customConstructors) {
          originalClass.addConstructor((customConstructor as any).getStructure());
        }
      }

      // Check if the custom class has a __generated private property
      const generatedProperty = customClass.getProperty("__generated");
      const isAugmentedClass = Boolean(
        generatedProperty &&
          generatedProperty.getType().getText() ===
            `_${customClass.getName()}` &&
          generatedProperty.hasModifier(SyntaxKind.PrivateKeyword)
      );

      for (const outMethod of originalClass.getMethods()) {
        let methodName = `${outMethod.getName()}`;
        const methodStructure: MethodDeclarationStructure =
          outMethod.getStructure() as MethodDeclarationStructure;

        const customMethod = customClass.getMethod(methodName);

        if (customMethod && isAugmentedClass) {
          methodName = `_${outMethod.getName()}`;
          methodStructure.name = methodName;
          methodStructure.scope = Scope.Private;
          customClass.addMethod(methodStructure);
        }
      }

      if (isAugmentedClass) {
        // Replace `this._generated.` with `this.` in custom method bodies
        for (const customMethod of customClass.getMethods()) {
          const bodyText = customMethod.getBodyText();
          const updatedBodyText = bodyText?.replace(
            /this\.__generated\./g,
            "this._"
          );
          if (bodyText !== updatedBodyText) {
            customMethod.setBodyText(updatedBodyText ?? "");
          }
        }
      }

      // Remove the __generated property from the custom class
      const __generatedProperty = customClass.getProperty("__generated");
      if (__generatedProperty) {
        __generatedProperty.remove();
      }

      // Replace the output class with the custom class
      originalClass.replaceWithText(customClass.getText());
    }
  }
}

export function isClassDeclaration(
  declaration?: Declaration
): declaration is ClassDeclaration {
  return declaration?.getKind() === SyntaxKind.ClassDeclaration;
}

export function mergeAndReplace<T extends Declaration>(
  customDeclarations: Map<string, T>,
  originalDeclarations: T[]
): void {
  for (const originalDeclaration of originalDeclarations) {
    const name = originalDeclaration.getName();
    const customDeclaration = name ? customDeclarations.get(name) : undefined;
    if (customDeclaration && name) {
      if (
        isFunction(customDeclaration) &&
        isFunction(originalDeclaration) &&
        isAugmented(customDeclarations.get(name) as FunctionDeclaration)
      ) {
        augmentFunction(originalDeclaration, customDeclaration);
        continue;
      }
      // This is an override just replace the original with the custom 
      originalDeclaration.replaceWithText(customDeclaration.getText());
    }
  }
}

export function mergeModuleDeclarations(
  customContent: string,
  originalContent: string
): string {
  const project = new Project();

  // Add the custom and out content as in-memory source files
  const customVirtualSourceFile = project.createSourceFile("custom.ts", customContent);
  const originalVirtualSourceFile = project.createSourceFile("out.ts", originalContent);

  // Create a map of of all the available customizations in the current file.
  const customDeclarationsMap = getCustomDeclarationsMap(customVirtualSourceFile);

  // Merge custom declarations into the out source file
  mergeAndReplace(
    customDeclarationsMap.functions,
    originalVirtualSourceFile.getFunctions()
  );
  mergeClasses(customDeclarationsMap.classes, originalVirtualSourceFile.getClasses());
  mergeAndReplace(
    customDeclarationsMap.interfaces,
    originalVirtualSourceFile.getInterfaces()
  );
  mergeAndReplace(
    customDeclarationsMap.typeAliases,
    originalVirtualSourceFile.getTypeAliases()
  );

  originalVirtualSourceFile.fixMissingImports();
  return originalVirtualSourceFile.getFullText();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
