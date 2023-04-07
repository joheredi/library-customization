export interface X {
    foo: string;
}

/**
 * This file is generated using the remodel generation script.
 */
export class Foo {
    bar: string;
    foo: string;
    baz: boolean;
    private _mayValue: string;

    constructor() {
    }

    public greet(): void {
        console.log("Hello World");
    }

    private sayHi(): void {
        console.log("Hello World");
    }
}
