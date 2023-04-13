import { ClassDeclaration, SourceFile, MethodDeclaration, Scope, PropertyDeclaration, CommentRange, JSDoc, StructureKind, ConstructorDeclaration } from "ts-morph";
import { isOverload } from "./helpers/overloads";

const AUGMENT_CLASS_TOKEN = "___";

export function augmentClass(originalClassDeclaration: ClassDeclaration | undefined, customClassDeclaration: ClassDeclaration, originalFile: SourceFile) {

  // If there is no original class declaration, we'll just copy the custom one
  if (!originalClassDeclaration) {
    const classComments = getComments(customClassDeclaration, originalClassDeclaration);
    addClass(customClassDeclaration, originalFile, classComments);
    return;
  }

  // Get custom properties
  const customProperties = customClassDeclaration.getProperties();
  for (const customProperty of customProperties) {
    const propertyName = customProperty.getName();

    // do not copy over to the output the AUGMENT_CLASS_TOKEN property
    // as it is just a token to determine if the class is augmented
    // and enable intellisense for the customization UX.
    if (propertyName === AUGMENT_CLASS_TOKEN) {
      continue;
    }

    const originalProperty = originalClassDeclaration.getProperty(propertyName);
    const propertyComments = getComments(customProperty, originalProperty)

    // If the property already exists in the original declaration, we'll replace it
    originalProperty?.remove();
    addPropertyToClass(customProperty, originalClassDeclaration, propertyComments);
    // originalClassDeclaration.addProperty(customProperty.getStructure());
  }

  // Get custom methods
  const customMethods = customClassDeclaration.getMethods();
  for (const customMethod of customMethods) {
    const methodName = customMethod.getName();

    // If the method already exists in the original declaration, we'll replace it
    const originalMethod = originalClassDeclaration.getMethod(methodName);
    augmentMethod(originalMethod, customMethod, originalClassDeclaration);
  }

  // Handle custom constructors
  const customCtors = customClassDeclaration.getConstructors();
  const originalCtors = originalClassDeclaration.getConstructors();
  let i = 0, j = 0;
  while (i < customCtors.length || j < originalCtors.length) {
    if (i === customCtors.length) {
      originalCtors[j++].remove();
      continue;
    }
    augmentConstructor(originalCtors[j++], customCtors[i++], originalClassDeclaration);
  }
}

export function augmentMethod(originalMethod: MethodDeclaration | undefined, customMethod: MethodDeclaration, originalClass: ClassDeclaration) {
  const methodComments = getComments(customMethod, originalMethod);
  // custom is adding a new method this is a new method on the class, we'll add it to original
  if (!originalMethod) {
    addMethodToClass(customMethod, originalClass, methodComments);
    return;
  }

  // Original method with the same name exists so
  // we need to check if the custom method is using the original method
  // to determine if we need to augment or replace
  if (isAugmentingMethod(customMethod)) {
    convertToPrivateMethod(originalMethod, originalClass);
    addMethodToClass(customMethod, originalClass, methodComments);
  }
  else {
    // This is not using the original method so we'll replace it
    originalMethod.remove();
    addMethodToClass(customMethod, originalClass, methodComments);
  }

}


function isAugmentingMethod(customMethod: MethodDeclaration): boolean {
  return Boolean(customMethod.getBody()?.getFullText()?.includes(`this.${AUGMENT_CLASS_TOKEN}.${customMethod.getName()}`));
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



export function addMethodToClass(customMethod: MethodDeclaration, classDeclaration: ClassDeclaration, { comments, jsdoc }: Comments = {}) {

  // We need to replace the augmentation call with the private method call
  if (isAugmentingMethod(customMethod) && !isOverload(customMethod.getStructure())) {
    const regex = new RegExp(`this\\.${AUGMENT_CLASS_TOKEN}.${customMethod.getName()}`, 'g');
    const modifiedMethodContent = customMethod.getBodyText()?.replace(regex, `this._${customMethod.getName()}`);
    modifiedMethodContent && customMethod.setBodyText(modifiedMethodContent);
  }

  const methodStructure = customMethod.getStructure();

  // custom is adding a new method this is a new method on the class, we'll add it to original
  if (!isOverload(methodStructure)) {
    classDeclaration.addMethod({
      ...methodStructure, docs: jsdoc?.map(jsDoc => jsDoc.getStructure()), leadingTrivia: writer => {
        comments?.forEach(comment => {
          writer.writeLine(comment.getText());
        });
      }
    });
  }
}

export function augmentConstructor(originalCtor: ConstructorDeclaration | undefined, customCtor: ConstructorDeclaration, originalClass: ClassDeclaration) {
  const ctorComments = getComments(customCtor, undefined);
  originalCtor?.remove();
  addConstructorToClass(customCtor, originalClass, ctorComments);
}

export function addConstructorToClass(customConstructor: ConstructorDeclaration, classDeclaration: ClassDeclaration, { comments, jsdoc }: Comments = {}) {
  const ctorStructure = customConstructor.getStructure();
  if (!isOverload(ctorStructure)) {
    classDeclaration.addConstructor({
      ...ctorStructure, docs: jsdoc?.map(jsDoc => jsDoc.getStructure()), leadingTrivia: writer => {
        comments?.forEach(comment => {
          writer.writeLine(comment.getText());
        });
      }
    });
  }
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

interface Comments {
  comments?: CommentRange[];
  jsdoc?: JSDoc[];
}

function getComments(customDeclaration: ClassDeclaration | PropertyDeclaration | MethodDeclaration | ConstructorDeclaration, originalDeclaration: ClassDeclaration | PropertyDeclaration | MethodDeclaration | ConstructorDeclaration | undefined): Comments {
  const customClassComments = customDeclaration.getLeadingCommentRanges();
  const customClassJSDocs = customDeclaration.getJsDocs();

  if (!originalDeclaration) {
    return {
      comments: customClassComments,
      jsdoc: customClassJSDocs,
    }
  }

  const originalClassComments = originalDeclaration.getLeadingCommentRanges();
  const originalClassJSDocs = originalDeclaration.getJsDocs();

  const comments = customClassComments.length === 0 ? originalClassComments : customClassComments;
  const jsdoc = customClassJSDocs.length === 0 ? originalClassJSDocs : customClassJSDocs;

  return {
    comments,
    jsdoc,
  }


}

function addPropertyToClass(property: PropertyDeclaration, classDeclaration: ClassDeclaration, { comments, jsdoc }: Comments = {}) {
  // Insert the class declaration, JSDocs, and leading comments into the target file
  classDeclaration.addProperty({
    ...property.getStructure(), docs: jsdoc?.map(jsDoc => jsDoc.getStructure()), leadingTrivia: writer => {
      comments?.forEach(comment => {
        writer.writeLine(comment.getText());
      });
    }
  });
}

function addClass(classDeclaration: ClassDeclaration, targetFile: SourceFile, { comments, jsdoc }: Comments = {}) {
  // Insert the class declaration, JSDocs, and leading comments into the target file
  targetFile.addStatements(writer => {
    // Write leading comments
    comments?.forEach(comment => {
      writer.writeLine(comment.getText());
    });

    // Write JSDocs
    jsdoc?.forEach(jsDoc => {
      writer.writeLine(jsDoc.getText());
    });

    // Write class declaration
    writer.write(classDeclaration.getText());
  });

  // Save the changes to the target file
  targetFile.saveSync();
}