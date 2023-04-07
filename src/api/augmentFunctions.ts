
function _foo() {
    console.log("In Original");
}

export function foo() {
    _foo();
    console.log("In Custom");
}
