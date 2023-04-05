# User Guide for Customizing Generated TypeScript Code

This program allows you to customize generated TypeScript code by merging customizations from a separate directory into the generated code. This guide will walk you through the process of customizing the generated code, explaining the options available to you, and providing examples of the expected output.

## Prerequisites

Before you begin, ensure that you have the generated TypeScript code in the `./generated` directory and your customizations in the `./custom` directory. **The custom files should have the same names and folder structure as the generated ones**. The program will output the merged code to the `./src` directory.

## Customizing Functions

### Example

**Generated Function (`generated/moduleA.ts`):**

```typescript
export function foo(input: string | string[]): void {
  console.log(input);
}
```

**Custom Function (`custom/moduleA.ts`):**

```typescript
import { foo as _foo } from "../generated/operations";

export function foo(input: string | string[]): void {
  const flatInput = typeof input === "string" ? input : input.join(" | ");
  _foo(flatInput);
}
```

**Merged Output (`src/moduleA.ts`):**

```typescript
function _foo(input: string | string[]) {
  console.log(input);
}

export function foo(input: string | string[]): void {
  const flatInput = typeof input === "string" ? input : input.join(" | ");
  _foo(flatInput);
}
```

## Customizing Classes

### Example

**Generated Class (`generated/moduleA.ts`):**

```typescript
export class MyClass {
  public propA: string = "A";

  public myMethod(): string {
    return this.propA;
  }
}
```

**Custom Class (`custom/moduleA.ts`):**

```typescript
import { MyClass as _MyClass } from "../generated/operations";

export class MyClass {
  private __generated: _MyClass;

  public propB: string = "B";

  public myMethod(): string {
    return this.__generated.myMethod() + " | " + this.propB;
  }
}
```

**Merged Output (`src/moduleA.ts`):**

```typescript
export class MyClass {
  // @ts-ignore
  public propB: string = "B";

  public myMethod(): string {
    return this._myMethod() + " | " + this.propB;
  }

  public propA: string = "A";

  private _myMethod(): string {
    return this.propA;
  }
}
```

## Customizing Interfaces and Type Aliases

### Example

**Generated Interface (`generated/moduleA.ts`):**

```typescript
export interface MyInterface {
  propA: string;
}
```

**Custom Interface (`custom/moduleA.ts`):**

```typescript
export interface MyInterface {
  propB: string;
}
```

**Merged Output (`src/moduleA.ts`):**
```typescript
export interface MyInterface {
  propA: string;
  propB: string;
}
```
