# TypeScript Precompile Script
This is a TypeScript precompile script that allows you to merge custom TypeScript modules with their corresponding modules in a source folder. The precompile script can be used to override/redefine parts of a module, or to augment it by adding new functions, classes, or interfaces.

## Installation
To use the precompile script, you'll need to have Node.js and npm installed on your system. You can download and install them from the official Node.js website: https://nodejs.org/en/

Once you have Node.js and npm installed, you can install the precompile script by running the following command in your terminal:

```sh
npm install
```s
This will install all the dependencies required by the precompile script.

## Usage
To use the precompile script, you'll need to create a generated folder and a custom folder at the root of your project. The generated folder should contain the original TypeScript modules, while the custom folder should contain the custom modules that you want to merge with the original modules.

Here's an example project structure:

```css
project_root/
├── src/
│   ├── moduleA.ts
│   ├── moduleB.ts
│   └── index.ts
├── custom/
│   ├── moduleA.ts
│   └── moduleB.ts
To run the precompile script, you can execute the following command in your terminal:
```

```sh
npm run precompile
```

This will run the precompile script, which will merge the custom modules with their corresponding modules in the src folder. The merged modules will be written to an `src` folder at the root of your project.