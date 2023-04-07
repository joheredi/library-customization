import { ClassDeclaration, FunctionDeclarationStructure, InterfaceDeclaration, MethodDeclarationStructure, Project, Scope, SourceFile, VariableDeclaration } from "ts-morph";

/**
 * This function will attempt to re-organize the source file contents
 * so that contents are groupped together by type.
 * For example, all classes will be grouped together, all interfaces will be grouped together, etc.
 */
export function sortSourceFileContents(sourceFile: SourceFile) {
    // Collect all elements of different types
    const variableStatements = sourceFile.getVariableStatements();
    const interfaces = sourceFile.getInterfaces();
    const typeAliases = sourceFile.getTypeAliases();
    const classes = sourceFile.getClasses();
    const functions = sourceFile.getFunctions();
    const enums = sourceFile.getEnums();

    // Sort elements by exported status
    const sortExportedFirst = (a: any, b: any) => (b.isExported() ? 1 : 0) - (a.isExported() ? 1 : 0);
    const variableStructures = variableStatements.sort(sortExportedFirst).map(statement => statement.getStructure());
    const interfaceStructures = interfaces.sort(sortExportedFirst).map(statement => statement.getStructure());
    const typeStructures = typeAliases.sort(sortExportedFirst).map(statement => statement.getStructure());
    const classStructures = classes.sort(sortExportedFirst).map(statement => { sortClassContents(statement); return statement.getStructure() });
    const functionStructures = functions.sort(sortExportedFirst).map(statement => statement.getStructure());
    const enumStructures = enums.sort(sortExportedFirst).map(statement => statement.getStructure());

    // Remove elements from the source file
    variableStatements.forEach(statement => statement.remove());
    interfaces.forEach(interfaceDeclaration => interfaceDeclaration.remove());
    typeAliases.forEach(typeAlias => typeAlias.remove());
    classes.forEach(classDeclaration => classDeclaration.remove());
    functions.forEach(functionDeclaration => functionDeclaration.remove());

    // Add elements back to the source file in the desired order
    variableStructures.forEach(statement => sourceFile.addVariableStatement(statement));
    interfaceStructures.forEach(interfaceDeclaration => sourceFile.addInterface(interfaceDeclaration));
    typeStructures.forEach(typeAlias => sourceFile.addTypeAlias(typeAlias));
    classStructures.forEach(classDeclaration => sourceFile.addClass(classDeclaration));
    functionStructures.forEach(functionDeclaration => sourceFile.addFunction(functionDeclaration as FunctionDeclarationStructure));
    enumStructures.forEach(enumDeclaration => sourceFile.addEnum(enumDeclaration));
}

function sortClassContents(classDeclaration: ClassDeclaration) {
    // Collect all elements of different types
    const properties = classDeclaration.getProperties();
    const methods = classDeclaration.getMethods();

    // Sort elements by visibility
    const sortVisibility = (a: {getScope(): Scope}, b: {getScope(): Scope}) => (a.getScope() === b.getScope() ? 0 : a.getScope() === "public" ? -1 : 1);
    const propertyStructures = properties.sort(sortVisibility).map(property => property.getStructure());
    const methodStructures = methods.sort(sortVisibility).map(method => method.getStructure());

    // Remove elements from the class
    properties.forEach(property => property.remove());
    methods.forEach(method => method.remove());

    // Add elements back to the class in the desired order
    propertyStructures.forEach(propertyStructure => classDeclaration.addProperty(propertyStructure));
    methodStructures.forEach(methodStructure => classDeclaration.addMethod(methodStructure as MethodDeclarationStructure));
}