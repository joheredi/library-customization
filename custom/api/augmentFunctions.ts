
import {foo as _foo}  from "./augmentFunctions";

export function foo() {
    _foo();
    console.log("In Custom");
}