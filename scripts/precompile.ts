import * as fs from "fs-extra";
import * as path from "path";
import { FunctionDeclarationOverloadStructure, FunctionDeclarationStructure, MethodDeclaration, PropertySignature, Signature, StructureKind } from "ts-morph";
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
  MethodDeclarationOverloadStructure,

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


export function augmentClass(originalClassDeclaration: ClassDeclaration | undefined, customClassDeclaration: ClassDeclaration, originalFile: SourceFile) {

  // If there is no original class declaration, we'll just copy the custom one
  if (!originalClassDeclaration) {
    const addedClass = originalFile.addClass(customClassDeclaration.getStructure());
    return;
  }

  // Get custom properties
  const customProperties = customClassDeclaration.getProperties();
  for (const customProperty of customProperties) {
    const propertyName = customProperty.getName();

    // do not copy over to the output the __customization property
    // as it is just a token to determine if the class is augmented
    // and enable intelisense for the customization UX.
    if (propertyName === "___") {
      continue;
    }

    // If the property already exists in the original declaration, we'll replace it
    originalClassDeclaration.getProperty(propertyName)?.remove();
    originalClassDeclaration.addProperty(customProperty.getStructure());
  }

  // Get custom methods
  const customMethods = customClassDeclaration.getMethods();
  for (const customMethod of customMethods) {
    const methodName = customMethod.getName();

    // If the method already exists in the original declaration, we'll replace it
    const originalMethod = originalClassDeclaration.getMethod(methodName);
    augmentMethod(originalMethod, customMethod, originalClassDeclaration);
  }
}


export function augmentFunctions(customFunctions: FunctionDeclaration[], originalFunctions: Map<string, FunctionDeclaration>, originalFile: SourceFile) {
  for (const customFunction of customFunctions) {
    const customFunctionName = customFunction.getName();
    const originalFunction = originalFunctions.get(customFunctionName ?? "");
    augmentFunction(customFunction, originalFunction, originalFile);
  }
}

export function augmentFunction(customFunction: FunctionDeclaration, originalFunction: FunctionDeclaration | undefined, originalFile: SourceFile) {
  // If the custom function doesn't exist in the original file, we just need to add it

  if (!originalFunction) {
    addFunctionToFile(customFunction, originalFile);
    return;
  }

  // Original function with the same name exists so
  // we need to check if the custom method is using the original method
  // to determine if we need to augment or replace
  if (isAugmentingFunction(customFunction)) {
    convertToPrivateFunction(originalFunction, originalFile);
    addFunctionToFile(customFunction, originalFile);
  } else {
    // This is not using the original method so we'll replace it
    originalFunction.remove();
    addFunctionToFile(customFunction, originalFile);
  }
}

export function augmentMethod(originalMethod: MethodDeclaration | undefined, customMethod: MethodDeclaration, originalClass: ClassDeclaration) {
  // custom is adding a new method this is a new method on the class, we'll add it to original
  if (!originalMethod) {
    addMethodToClass(customMethod, originalClass);
    return;
  }

  // Original method with the same name exists so
  // we need to check if the custom method is using the original method
  // to determine if we need to augment or replace
  if (isAugmentingMethod(customMethod)) {
    convertToPrivateMethod(originalMethod, originalClass);
    addMethodToClass(customMethod, originalClass);
  }
  else {
    // This is not using the original method so we'll replace it
    originalMethod.remove();
    addMethodToClass(customMethod, originalClass);
  }

}

function isAugmentingFunction(fn: FunctionDeclaration): boolean {
  const customFunctionContent = fn.getBody()?.getFullText();

  if (customFunctionContent?.includes(`_${fn.getName()}`)) {
    return true;
  }

  return false;
}

function isAugmentingMethod(customMethod: MethodDeclaration): boolean {
  const customMethodContent = customMethod.getBody()?.getFullText();

  if (customMethodContent?.includes(`this.___.${customMethod.getName()}`)) {
    return true;
  }

  return false;
}


export function convertToPrivateFunction(originalFunction: FunctionDeclaration, originalFile: SourceFile) {
  const functionStructure = originalFunction.getStructure();
  const functionOverloads = originalFunction.getOverloads();

  if (isOverload(functionStructure)) {
    return;
  }

  functionStructure.isExported = false;
  functionStructure.name = `_${functionStructure.name}`;

  const newFunction = originalFile.addFunction(functionStructure);

  for (const overload of functionOverloads) {
    const overloadStructure = overload.getStructure();
    if (isOverload(overloadStructure)) {
      overloadStructure.isExported = false;
      newFunction.addOverload(overloadStructure);
    }
  }
  originalFunction.remove();
}

export function convertToPrivateMethod(originalMethod: MethodDeclaration, originalClass: ClassDeclaration) {
  const methodStructure = originalMethod.getStructure();
  const methodOverloads = originalMethod.getOverloads();
  if (isOverload(methodStructure)) {
    return;
  }

  methodStructure.scope = Scope.Private;
  methodStructure.name = `_${methodStructure.name}`;

  const newMethod = originalClass.addMethod(methodStructure);

  for (const overload of methodOverloads) {
    const overloadStructure = overload.getStructure();
    if (isOverload(overloadStructure)) {
      overloadStructure.scope = Scope.Private;
      newMethod.addOverload(overloadStructure);
    }
  }
  originalMethod.remove();
}

export function addFunctionToFile(fn: FunctionDeclaration, file: SourceFile) {
  const functionStructure = fn.getStructure();

  // custom is adding a new function this is a new method on the class, we'll add it to original
  if (!isOverload(functionStructure)) {
    const addedFunction = file.addFunction(functionStructure);
    const overloads = fn.getOverloads();
    for (const overload of overloads) {
      const overloadStructure = overload.getStructure();
      if (isOverload(overloadStructure)) {
        addedFunction.addOverload(overloadStructure);
      }
    }
  }
}

export function addMethodToClass(customMethod: MethodDeclaration, classDeclaration: ClassDeclaration) {

  // We need to replace the augmentation call with the private method call
  if (isAugmentingMethod(customMethod) && !isOverload(customMethod.getStructure())) {
    const regex = new RegExp(`this\\.___.${customMethod.getName()}`, 'g');
    const modifiedMethodContent = customMethod.getBodyText()?.replace(regex, `this._${customMethod.getName()}`);
    modifiedMethodContent && customMethod.setBodyText(modifiedMethodContent);
  }

  const methodStructure = customMethod.getStructure();

  // custom is adding a new method this is a new method on the class, we'll add it to original
  if (!isOverload(methodStructure)) {
    const addedMethod = classDeclaration.addMethod(methodStructure);
    const overloads = customMethod.getOverloads();
    for (const overload of overloads) {
      const overloadStructure = overload.getStructure();
      if (isOverload(overloadStructure)) {
        addedMethod.addOverload(overloadStructure);
      }
    }
  }
}

function isOverload(method: FunctionDeclarationStructure | FunctionDeclarationOverloadStructure): method is FunctionDeclarationOverloadStructure;
function isOverload(method: MethodDeclarationStructure | MethodDeclarationOverloadStructure): method is MethodDeclarationOverloadStructure;
function isOverload(method: MethodDeclarationStructure | MethodDeclarationOverloadStructure | FunctionDeclarationStructure | FunctionDeclarationOverloadStructure): method is (FunctionDeclarationOverloadStructure | MethodDeclarationOverloadStructure) {
  return method.kind === StructureKind.MethodOverload || method.kind === StructureKind.FunctionOverload;
}

export function augmentClasses(
  originalClasses: Map<string, ClassDeclaration>,
  customClasses: ClassDeclaration[],
  originalFile: SourceFile
) {
  for (const customClass of customClasses) {
    const customClassName = customClass.getName();
    const originalClass = originalClasses.get(customClassName ?? "");
    augmentClass(originalClass, customClass, originalFile);
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
  mergeAndReplace(
    originalDeclarationsMap.typeAliases,
    originalVirtualSourceFile.getTypeAliases()
  );

  originalVirtualSourceFile.fixMissingImports();
  return originalVirtualSourceFile.getFullText();
}

export function augmentInterfaces(originalInterfaces: Map<string, InterfaceDeclaration>, customInterfaces: InterfaceDeclaration[], originalFile: SourceFile) {
  for (const customInterface of customInterfaces) {
    const originalInterface = originalInterfaces.get(customInterface.getName() ?? "");
    augmentInterface(customInterface, originalInterface, originalFile)
  }
}

export function augmentInterface(customInterface: InterfaceDeclaration, originalInterface: InterfaceDeclaration | undefined, originalFile: SourceFile) {
  // If there is no interface with the same name in the original file, we'll add it
  if (!originalInterface) {
    originalFile.addInterface(customInterface.getStructure());
    return;
  }

  // Remove any properties marked with // @azsdk-remove 
  removeProperties(customInterface, originalInterface);

  // Merge the properties from the custom interface into the original interface
  mergeProperties(customInterface, originalInterface);
}

export function mergeProperties(customInterface: InterfaceDeclaration, originalInterface: InterfaceDeclaration) {
  const customProperties = customInterface.getProperties();
  for (const customProperty of customProperties) {
    const propertyName = customProperty.getName();
    const originalProperty = originalInterface.getProperty(propertyName);

    // If the property already exists in the original interface, we'll remove it
    if (originalProperty) {
      originalProperty.remove();
    }

    // Add the custom property
    if(getAnnotation(customProperty) !== "Remove") {
      originalInterface.addProperty(customProperty.getStructure());
    }
  }
}

export function removeProperties(customInterface: InterfaceDeclaration, originalInterface: InterfaceDeclaration) {
  const customProperties = customInterface.getProperties();
  for (const customProperty of customProperties) {
    const propertyName = customProperty.getName();

    // Check if the property has a `// @azsdk-remove` comment
    if (getAnnotation(customProperty) === "Remove") {
      originalInterface.getProperty(propertyName)?.remove();
    }
  }
}

export type Annotation = "Remove";
export function getAnnotation(declaration: Declaration | PropertySignature): Annotation | undefined {
  // Check if the property has a `// @azsdk-remove` comment
  const leadingCommentRanges = declaration.getLeadingCommentRanges();
  if (leadingCommentRanges) {
    for (const commentRange of leadingCommentRanges) {

      const commentText = commentRange.getText();

      const regex = /@azsdk-(\w+)/;
      const match = commentText.match(regex);
      const annotation = match ? match[0] : null;

      if (annotation === "@azsdk-remove") {
        return "Remove";
      }

      return undefined;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
