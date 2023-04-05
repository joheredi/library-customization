import {Bar as _Bar} from "../../generated/api/classMerge";
import { MyClass as _MyClass } from "../../generated/api/classMerge";


export class Bar {
    // @ts-ignore
    private __generated: _Bar;
    
    private baz = "baz";

    foo() {
        this.__generated.foo();
        console.log(this.baz);
    }
}


export class MyClass {
    // @ts-ignore
  private __generated: _MyClass;

  public propB: string = "B";

  public myMethod(): string {
    return this.__generated.myMethod() + " | " + this.propB;
  }
}