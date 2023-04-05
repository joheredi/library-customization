export class Bar {
    
    private baz = "baz";

    foo() {
        this._foo();
        console.log(this.baz);
    }

    private bax = "baz";

    private _foo() {
        console.log(this.bax);
    }

    bar() {
    }
}


export class MyClass {
    
  public propB: string = "B";

  public myMethod(): string {
      return this._myMethod() + " | " + this.propB;
  }

    public propA: string = "A";

    private _myMethod(): string {
        return this.propA;
    }
}