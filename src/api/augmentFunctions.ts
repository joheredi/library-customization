export function foo() {
    _foo();
    console.log("In Custom");
}

function _foo() {
    console.log("In Original");
}
