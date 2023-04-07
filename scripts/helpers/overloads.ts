import { FunctionDeclarationOverloadStructure, FunctionDeclarationStructure, MethodDeclarationOverloadStructure, MethodDeclarationStructure, StructureKind } from "ts-morph";

export function isOverload(method: FunctionDeclarationStructure | FunctionDeclarationOverloadStructure): method is FunctionDeclarationOverloadStructure;
export function isOverload(method: MethodDeclarationStructure | MethodDeclarationOverloadStructure): method is MethodDeclarationOverloadStructure;
export function isOverload(method: MethodDeclarationStructure | MethodDeclarationOverloadStructure | FunctionDeclarationStructure | FunctionDeclarationOverloadStructure): method is (FunctionDeclarationOverloadStructure | MethodDeclarationOverloadStructure) {
  return method.kind === StructureKind.MethodOverload || method.kind === StructureKind.FunctionOverload;
}
