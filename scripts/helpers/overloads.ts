import { ConstructorDeclarationOverloadStructure, ConstructorDeclarationStructure, FunctionDeclarationOverloadStructure, FunctionDeclarationStructure, MethodDeclarationOverloadStructure, MethodDeclarationStructure, StructureKind } from "ts-morph";

export function isOverload(method: FunctionDeclarationStructure | FunctionDeclarationOverloadStructure): method is FunctionDeclarationOverloadStructure;
export function isOverload(method: MethodDeclarationStructure | MethodDeclarationOverloadStructure): method is MethodDeclarationOverloadStructure;
export function isOverload(method: ConstructorDeclarationStructure | ConstructorDeclarationOverloadStructure): method is ConstructorDeclarationOverloadStructure;
export function isOverload(method: MethodDeclarationStructure | MethodDeclarationOverloadStructure | FunctionDeclarationStructure | FunctionDeclarationOverloadStructure | ConstructorDeclarationStructure | ConstructorDeclarationOverloadStructure): method is (FunctionDeclarationOverloadStructure | MethodDeclarationOverloadStructure) {
  return method.kind === StructureKind.MethodOverload || method.kind === StructureKind.FunctionOverload || method.kind === StructureKind.ConstructorOverload;
}
