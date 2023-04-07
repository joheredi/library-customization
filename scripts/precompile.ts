import * as fs from "fs-extra";
import * as path from "path";
import {
  Project,
  FunctionDeclaration,
  ClassDeclaration,
  InterfaceDeclaration,
  TypeAliasDeclaration,
  SourceFile,

} from "ts-morph";
import { augmentFunctions } from "./functions";
import { augmentClasses } from "./classes";
import { augmentInterfaces } from "./interfaces";
import { sortSourceFileContents } from "./helpers/preformat";

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

export function getOriginalDeclarationsMap(
  sourceFile: SourceFile
): CustomDeclarationsMap {
  const originalDeclarationsMap: CustomDeclarationsMap = {
    functions: new Map<string, FunctionDeclaration>(),
    classes: new Map<string, ClassDeclaration>(),
    interfaces: new Map<string, InterfaceDeclaration>(),
    typeAliases: new Map<string, TypeAliasDeclaration>(),
  };

  // Collect custom declarations
  for (const originalFunction of sourceFile.getFunctions()) {
    const functionName = originalFunction.getName();
    if (!functionName) {
      // skip anonymous functions
      continue;
    }
    originalDeclarationsMap.functions.set(functionName, originalFunction);
  }
  for (const originalClass of sourceFile.getClasses()) {
    const className = originalClass.getName();
    if (!className) {
      // skip anonymous classes
      continue;
    }
    originalDeclarationsMap.classes.set(className, originalClass);
  }
  for (const originalInterface of sourceFile.getInterfaces()) {
    originalDeclarationsMap.interfaces.set(
      originalInterface.getName(),
      originalInterface
    );
  }
  for (const originalTypeAlias of sourceFile.getTypeAliases()) {
    originalDeclarationsMap.typeAliases.set(
      originalTypeAlias.getName(),
      originalTypeAlias
    );
  }

  return originalDeclarationsMap;
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

export function mergeModuleDeclarations(
  customContent: string,
  originalContent: string
): string {
  const project = new Project();

  // Add the custom and out content as in-memory source files
  const customVirtualSourceFile = project.createSourceFile("custom.ts", customContent);
  const originalVirtualSourceFile = project.createSourceFile("out.ts", originalContent);

  // Create a map of of all the available customizations in the current file.
  const originalDeclarationsMap = getOriginalDeclarationsMap(originalVirtualSourceFile);

  // Merge custom declarations into the out source file
  augmentFunctions(
    customVirtualSourceFile.getFunctions(),
    originalDeclarationsMap.functions,
    originalVirtualSourceFile,
  );

  augmentClasses(originalDeclarationsMap.classes, customVirtualSourceFile.getClasses(), originalVirtualSourceFile);

  augmentInterfaces(
    originalDeclarationsMap.interfaces,
    customVirtualSourceFile.getInterfaces(),
    originalVirtualSourceFile
  );

  originalVirtualSourceFile.fixMissingImports();
  sortSourceFileContents(originalVirtualSourceFile)
  return originalVirtualSourceFile.getFullText();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
