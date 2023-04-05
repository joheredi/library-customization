export class Bar {
    private bax = "baz";
    foo() {
        console.log(this.bax);
    }

    bar() {}
}


export class MyClass {
    public propA: string = "A";
  
    public myMethod(): string {
      return this.propA;
    }
  }