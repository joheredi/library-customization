import * as fs from "fs-extra";
import * as path from "path";
import { Project, SyntaxKind } from "ts-morph";

const srcDir = "./generated";
const customDir = "./custom";
const outDir = "./src";

async function main() {
  // Copy the entire src folder to the out folder
  await fs.copy(srcDir, outDir);

  // Merge the module declarations for all files in the custom directory and its subdirectories
  await mergeAllModuleDeclarations(customDir, outDir);
}

export async function mergeAllModuleDeclarations(
  customDir: string,
  outDir: string
): Promise<void> {
  const project = new Project();

  const processFile = async (customFilePath: string, outFilePath: string) => {
    const customContent = await fs.readFile(customFilePath, "utf8");
    const outContent = await fs.readFile(outFilePath, "utf8");

    const mergedContent = mergeModuleDeclarations(customContent, outContent);
    await fs.writeFile(outFilePath, mergedContent);
  };

  const processDirectory = async (customDir: string, outDir: string) => {
    const entries = await fs.readdir(customDir, { withFileTypes: true });

    for (const entry of entries) {
      const customPath = path.join(customDir, entry.name);
      const outPath = path.join(outDir, entry.name);

      if (entry.isFile() && path.extname(entry.name) === ".ts") {
        await processFile(customPath, outPath);
      } else if (entry.isDirectory()) {
        const subCustomDir = path.join(customDir, entry.name);
        const subOutDir = path.join(outDir, entry.name);
        await fs.ensureDir(subOutDir);
        await processDirectory(subCustomDir, subOutDir);
      }
    }
  };

  await processDirectory(customDir, outDir);
}

export function mergeModuleDeclarations(
  customContent: string,
  outContent: string
): string {
  const project = new Project();

  // Add the custom and out content as in-memory source files
  const customSourceFile = project.createSourceFile("custom.ts", customContent);
  const outSourceFile = project.createSourceFile("out.ts", outContent);

  const customDeclarations = new Map<string, any>();

  // Collect custom declarations
  customSourceFile.forEachChild((node) => {
    if (
      node.getKind() === SyntaxKind.FunctionDeclaration ||
      node.getKind() === SyntaxKind.ClassDeclaration ||
      node.getKind() === SyntaxKind.InterfaceDeclaration ||
      node.getKind() === SyntaxKind.TypeAliasDeclaration
    ) {
      const name = (node as any).getName();
      if (name) {
        customDeclarations.set(name, node);
      }
    }
  });

  // Merge custom declarations into the out source file
  outSourceFile.forEachChild((node) => {
    if (
      node.getKind() === SyntaxKind.FunctionDeclaration ||
      node.getKind() === SyntaxKind.ClassDeclaration ||
      node.getKind() === SyntaxKind.InterfaceDeclaration ||
      node.getKind() === SyntaxKind.TypeAliasDeclaration
    ) {
      const name = (node as any).getName();
      if (name && customDeclarations.has(name)) {
        node.replaceWithText(customDeclarations.get(name).getText());
      }
    }
  });

  outSourceFile.fixMissingImports();
  return outSourceFile.getFullText();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
