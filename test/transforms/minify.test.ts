import JsConfuser from "../../src/index";

test("Variant #1: Group variable declarations together", async () => {
  var code = `
  var a = 0;
  var b = 1;
  TEST_OUTPUT = a + b;
  `;

  var { code: output } = await JsConfuser.obfuscate(code, {
    target: "browser",
    minify: true,
  });

  expect(output).toContain("var a=0,b=1");

  var TEST_OUTPUT;

  eval(output);

  expect(TEST_OUTPUT).toStrictEqual(1);
});

test("Variant #2: Remove block statements when not necessary", async () => {
  var code = `
  while(condition){
    doStuff();
  }
  `;

  var { code: output } = await JsConfuser.obfuscate(code, {
    target: "browser",
    minify: true,
  });

  expect(output).not.toContain("{");
  expect(output).toContain("doStuff()");
});

test("Variant #3: Shorten guaranteed returns", async () => {
  var code = `
  function TEST_FUNCTION(condition){
    if ( condition ) {
      return 1;
    } else {
      return 0;
    }
  }

  TEST_OUTPUT = TEST_FUNCTION(true);
  `;

  var { code: output } = await JsConfuser.obfuscate(code, {
    target: "browser",
    minify: true,
  });

  expect(output).not.toContain("if");
  expect(output).toContain("?");

  var TEST_OUTPUT;

  eval(output);

  expect(TEST_OUTPUT).toStrictEqual(1);
});

test("Variant #4: Shorten guaranteed assignment expressions", async () => {
  var code = `
  function TEST_FUNCTION(condition){
    var value;
    if ( condition ) {
      value = 1;
    } else {
      value = 0;
    }

    TEST_OUTPUT = value;
  }

  TEST_FUNCTION(true);
  `;

  var { code: output } = await JsConfuser.obfuscate(code, {
    target: "browser",
    minify: true,
  });

  expect(output).not.toContain("if");
  expect(output).toContain("value=");
  expect(output).toContain("?");

  var TEST_OUTPUT;

  eval(output);

  expect(TEST_OUTPUT).toStrictEqual(1);
});

test("Variant #5: Work when shortening nested if-statements", async () => {
  var code = `
  var a = false;
  var b = true;
  if( a ) {
    if ( b ) {

    }
  } else {
    input(10)
  }
  `;

  var { code: output } = await JsConfuser.obfuscate(code, {
    target: "browser",
    minify: true,
  });

  expect(output).not.toContain("=>");

  var value = "never_called",
    input = (x) => (value = x);

  eval(output);

  expect(value).toStrictEqual(10);
});

test("Variant #8: Shorten simple array destructuring", async () => {
  // Valid
  var { code: output } = await JsConfuser.obfuscate(
    `var [x] = [1]; TEST_OUTPUT = x;`,
    {
      target: "node",
      minify: true,
    }
  );

  expect(output).toContain("var x=1");

  var TEST_OUTPUT;
  eval(output);

  expect(TEST_OUTPUT).toStrictEqual(1);

  // Invalid
  var { code: output2 } = await JsConfuser.obfuscate(`var [x, y] = [1]`, {
    target: "node",
    minify: true,
  });

  expect(output2).toContain("var[x,y]");
});

test("Variant #9: Shorten simple object destructuring", async () => {
  // Valid
  var { code: output } = await JsConfuser.obfuscate(
    `var {x} = {x: 1}; TEST_OUTPUT = x;`,
    {
      target: "node",
      minify: true,
    }
  );

  expect(output).toContain("var x=1");

  var TEST_OUTPUT;
  eval(output);

  expect(TEST_OUTPUT).toStrictEqual(1);

  // Valid
  var { code: output2 } = await JsConfuser.obfuscate(
    `var {['x']: y} = {x: 1}; TEST_OUTPUT_2 = y;`,
    {
      target: "node",
      minify: true,
    }
  );

  expect(output2).toContain("var y=1");

  var TEST_OUTPUT_2;
  eval(output2);

  expect(TEST_OUTPUT_2).toStrictEqual(1);

  // Invalid
  var { code: output3 } = await JsConfuser.obfuscate(`var {x,y} = {x:1}`, {
    target: "node",
    minify: true,
  });

  expect(output3).toContain("var{x,y}=");

  // Invalid
  var { code: output4 } = await JsConfuser.obfuscate(`var {y} = {x:1}`, {
    target: "node",
    minify: true,
  });

  expect(output4).toContain("var{y}=");
});

test("Variant #10: Shorten booleans", async () => {
  // Valid
  var { code: output } = await JsConfuser.obfuscate(
    `var x = true; TEST_OUTPUT = x;`,
    {
      target: "node",
      minify: true,
    }
  );

  expect(output).toContain("var x=!0");

  var TEST_OUTPUT;
  eval(output);

  expect(TEST_OUTPUT).toStrictEqual(true);

  // Valid
  var { code: output2 } = await JsConfuser.obfuscate(
    `var x = false; TEST_OUTPUT_2 = x;`,
    {
      target: "node",
      minify: true,
    }
  );

  expect(output2).toContain("var x=!1");

  var TEST_OUTPUT_2;
  eval(output2);

  expect(TEST_OUTPUT_2).toStrictEqual(false);
});

test("Variant #11: Shorten 'undefined' to 'void 0'", async () => {
  // Valid
  var { code: output } = await JsConfuser.obfuscate(`x = undefined;`, {
    target: "node",
    minify: true,
  });

  expect(output).toContain("x=void 0");

  // Valid
  var { code: output2 } = await JsConfuser.obfuscate(
    `var x = {undefined: 1}; TEST_OUTPUT = x`,
    {
      target: "node",
      minify: true,
    }
  );

  expect(output2).toContain("var x={[void 0]:1}");

  var { code: output3 } = await JsConfuser.obfuscate(
    `try { var undefined; (undefined) = true } catch(e) {}`,
    {
      target: "node",
      minify: true,
    }
  );

  eval(output3);
});

test("Variant #11: Shorten 'Infinity' to 1/0", async () => {
  // Valid
  var { code: output } = await JsConfuser.obfuscate(
    `var x = Infinity; TEST_OUTPUT = x;`,
    {
      target: "node",
      minify: true,
    }
  );

  expect(output).toContain("var x=1/0");

  var TEST_OUTPUT;
  eval(output);

  // Valid
  var { code: output2 } = await JsConfuser.obfuscate(
    `var x = {Infinity: 1}; TEST_OUTPUT = x;`,
    {
      target: "node",
      minify: true,
    }
  );

  expect(output2).toContain("var x={[1/0]:1}");
});

test("Variant #12: Shorten '!false' to '!0'", async () => {
  // Valid
  var { code: output } = await JsConfuser.obfuscate(
    `var x = !false; TEST_OUTPUT = x;`,
    {
      target: "node",
      minify: true,
    }
  );

  expect(output).toContain("var x=!0");

  var TEST_OUTPUT;
  eval(output);

  expect(TEST_OUTPUT).toStrictEqual(true);
});

test("Variant #13: Shorten 'false ? a : b' to 'b'", async () => {
  // Valid
  var { code: output } = await JsConfuser.obfuscate(
    `var x = false ? 10 : 15; TEST_OUTPUT = x;`,
    {
      target: "node",
      minify: true,
    }
  );

  expect(output).toContain("var x=15");

  var TEST_OUTPUT;
  eval(output);

  expect(TEST_OUTPUT).toStrictEqual(15);
});

test("Variant #14: Shorten 'var x = undefined' to 'var x'", async () => {
  // Valid
  var { code: output } = await JsConfuser.obfuscate(
    `var x = undefined; TEST_OUTPUT = x;`,
    {
      target: "node",
      minify: true,
    }
  );

  expect(output).toContain("var x");
  expect(output).not.toContain("var x=");

  var TEST_OUTPUT;
  eval(output);

  expect(TEST_OUTPUT).toStrictEqual(undefined);
});

test("Variant #15: Remove implied 'return'", async () => {
  // Valid
  var { code: output } = await JsConfuser.obfuscate(
    `
  function MyFunction(){ 
    var output = "Hello World";
    console.log(output);
    this; // Stop arrow function conversion
    return;
  } 
  
  MyFunction();
  `,
    { target: "node", minify: true }
  );

  expect(output).not.toContain("return");

  // Invalid
  // https://github.com/MichaelXF/js-confuser/issues/34
  var { code: output2 } = await JsConfuser.obfuscate(
    `
  function greet(){ 
    if(true){ 
      console.log("return"); 
      return; 
    }

    var output = "should not show!"; console.log(output); 
  } 
  
  greet();
  `,
    { target: "browser", minify: true }
  );

  expect(output2).toContain("return");
});

// https://github.com/MichaelXF/js-confuser/issues/43
test("Variant #16: Handle deconstructuring in for loop", async () => {
  // Valid
  var { code: output } = await JsConfuser.obfuscate(
    `
    for(const [a] of [[1]]) {
        input(a);
    }
  `,
    { target: "node", minify: true }
  );

  var value;
  function input(valueIn) {
    value = valueIn;
  }

  eval(output);

  expect(value).toStrictEqual(1);
});

test("Variant #17: Remove unreachable code following a return statement", async () => {
  var { code: output } = await JsConfuser.obfuscate(
    `
    function myFunction(){
      return;
      unreachableStmt;
    }
  `,
    { target: "node", minify: true }
  );

  expect(output).not.toContain("unreachableStmt");
});

test("Variant #18: Remove unreachable code following a continue or break statement", async () => {
  var { code: output } = await JsConfuser.obfuscate(
    `
    for(var i =0; i < 10; i++){
      continue;
      unreachableStmt
    }

    while(true){
      break;
      unreachableStmt
    }
  `,
    { target: "node", minify: true }
  );

  expect(output).not.toContain("unreachableStmt");
});

test("Variant #19: Remove unreachable code following a throw statement", async () => {
  var { code: output } = await JsConfuser.obfuscate(
    `
    throw new Error("No more code to run");
    unreachableStmt;
  `,
    { target: "node", minify: true }
  );

  expect(output).not.toContain("unreachableStmt");
});

// https://github.com/MichaelXF/js-confuser/issues/76
test("Variant #20: Properly handle objects with `, ^, [, ] as keys", async () => {
  var { code: output } = await JsConfuser.obfuscate(
    `
  TEST_OBJECT = {
    "\`": true,
    "^": true,
    "]": true,
    "[": true
  };
  `,
    {
      target: "node",
      minify: true,
    }
  );

  var TEST_OBJECT;
  eval(output);

  expect(TEST_OBJECT).toStrictEqual({
    "`": true,
    "^": true,
    "]": true,
    "[": true,
  });
});

// https://github.com/MichaelXF/js-confuser/issues/75
test("Variant #21: Properly handle Object constructor (Function Declaration)", async () => {
  var { code: output } = await JsConfuser.obfuscate(
    `
  function MyClass() {};

  var myObject = new MyClass();

  TEST_OUTPUT = myObject instanceof MyClass;
  `,
    { target: "node", minify: true }
  );

  var TEST_OUTPUT = false;
  eval(output);

  expect(TEST_OUTPUT).toStrictEqual(true);
});

test("Variant #22: Properly handle Object constructor (Function Expression)", async () => {
  var { code: output } = await JsConfuser.obfuscate(
    `
  var MyClass = function() {};

  var myObject = new MyClass();

  TEST_OUTPUT = myObject instanceof MyClass;
  `,
    { target: "node", minify: true }
  );

  var TEST_OUTPUT = false;
  eval(output);

  expect(TEST_OUTPUT).toStrictEqual(true);
});

test("Variant #23: Shorten property names and method names", async () => {
  var { code: output } = await JsConfuser.obfuscate(
    `
  var myObject = { "myKey": "Correct Value" };
  var myClass = class { ["myMethod"](){ return "Correct Value" } }

  TEST_OUTPUT = myObject.myKey === (new myClass()).myMethod();
  `,
    { target: "node", minify: true }
  );

  expect(output).not.toContain("'myKey'");
  expect(output).not.toContain("'myMethod'");

  var TEST_OUTPUT;
  eval(output);

  expect(TEST_OUTPUT).toStrictEqual(true);
});

test("Variant #24: Variable grouping in switch case", async () => {
  var { code: output } = await JsConfuser.obfuscate(
    `
  switch(true){
    case true:
      var myVar1 = "";
      var myVar2 = "";
      var myVar3 = "Correct Value";
      var myVar4 = "";

      TEST_OUTPUT = myVar1 + myVar2 + myVar3 + myVar4;
    break;
  }
  `,
    { target: "node", minify: true }
  );

  // Ensure the variable declarations were grouped
  expect(output).toContain('var myVar1="",myVar2="",myVar3=');

  var TEST_OUTPUT;
  eval(output);

  expect(TEST_OUTPUT).toStrictEqual("Correct Value");
});

test("Variant #25: Don't break redefined function declaration", async () => {
  var { code: output } = await JsConfuser.obfuscate(
    `
  function a(){ TEST_OUTPUT = 1 };
  function a(){ TEST_OUTPUT = 2 };
  function a(){ TEST_OUTPUT = 3 };

  a();
  `,
    { target: "node", minify: true }
  );

  var TEST_OUTPUT;
  eval(output);

  expect(TEST_OUTPUT).toStrictEqual(3);
});

// https://github.com/MichaelXF/js-confuser/issues/91
test("Variant #27: Preserve function.length property", async () => {
  var { code: output } = await JsConfuser.obfuscate(
    `
    function oneParameter(a){};
    var twoParameters = function({a},{b,c},...d){};
    function threeParameters(a,b,c,d = 1,{e},...f){};

    TEST_OUTPUT = oneParameter.length + twoParameters.length + threeParameters.length;
  `,
    { target: "node", minify: true }
  );

  var TEST_OUTPUT;
  eval(output);

  expect(TEST_OUTPUT).toStrictEqual(6);
});

// https://github.com/MichaelXF/js-confuser/issues/125
test("Variant #28: Don't break destructuring assignment", async () => {
  var { code: output } = await JsConfuser.obfuscate(
    `
    let objectSlice = [];
    objectSlice.push({
      a: 1,
      b: 2,
      c: 3,
    })
    for (let {
      a,
      b,
      c
    } of objectSlice) {
      TEST_OUTPUT = a + b + c;
    }
  `,
    { target: "node", minify: true }
  );

  var TEST_OUTPUT;
  eval(output);

  expect(TEST_OUTPUT).toStrictEqual(6);
});

test("Variant #28: Remove unused variables", async () => {
  var { code } = await JsConfuser.obfuscate(
    `
    var x = "Incorrect Value";
    var y = "Correct Value";
    TEST_OUTPUT = y;
    `,
    { target: "node", minify: true }
  );

  expect(code).not.toContain("x");
  expect(code).not.toContain("Incorrect Value");

  var TEST_OUTPUT;
  eval(code);

  expect(TEST_OUTPUT).toStrictEqual("Correct Value");
});

test("Variant #29: Remove unused functions", async () => {
  var { code } = await JsConfuser.obfuscate(
    `
    function unusedFunction(){
      return "Incorrect Value"
    }

    function usedFunction(){
      return "Correct Value"
    }

    TEST_OUTPUT = usedFunction();
    `,
    { target: "node", minify: true }
  );

  expect(code).not.toContain("unusedFunction");
  expect(code).not.toContain("Incorrect Value");
  expect(code).toContain("usedFunction");

  var TEST_OUTPUT;
  eval(code);

  expect(TEST_OUTPUT).toStrictEqual("Correct Value");
});

test("Variant #30: Remove unreachable code after branches", async () => {
  var { code } = await JsConfuser.obfuscate(
    `
  function ifStatementBranch(condition){
    if( !condition ) {
      return "Incorrect Value";
      return "Should be removed";
    }

    if( condition ) {
      return "Correct Value";
    } else {
      return "Incorrect Value"; 
    }
    
    "Should be removed";
    return "Should be removed";
  }

  function switchStatementBranch(condition){
    switch(condition){
      case "FakeValue1":
        return "Correct Value";
      case "FakeValue2":
        return "Incorrect Value";
    }

    switch(condition){
      case true:
        return "Correct Value";
      case false:
        if( condition ) {
          return "Incorrect Value";
        } else {
          return "Incorrect Value"; 
        }

        return "Should be removed";
      default:
        return "Incorrect Value";
        return "Should be removed";
    }

    "Should be removed";
    return "Should be removed";
  }

  TEST_OUTPUT = [ifStatementBranch(true), switchStatementBranch(true)];
    `,
    { target: "node", minify: true }
  );

  expect(code).not.toContain("Should be removed");

  var TEST_OUTPUT;
  eval(code);

  expect(TEST_OUTPUT).toStrictEqual(["Correct Value", "Correct Value"]);
});

test("Variant #31: Dead code elimination", async () => {
  var { code } = await JsConfuser.obfuscate(
    `
    function deadCodeElimination(){
      TEST_OUTPUT = [];
      if( true ) {
        var one = 1;
        TEST_OUTPUT.push(one)
      } else {
        TEST_OUTPUT.push("Should be removed") 
      }

      if( false ) {
        TEST_OUTPUT.push("Should be removed") 
      } else {
        var two = 2;
        TEST_OUTPUT.push(two)
      }

      if( true ) {
      } else {
        TEST_OUTPUT.push("Should be removed")
      }

      if(false) {
      } else {
        var three = 3;
        TEST_OUTPUT.push(three)
      }
    }

    deadCodeElimination();
    `,
    { target: "node", minify: true }
  );

  expect(code).not.toContain("Should be removed");

  var TEST_OUTPUT;
  eval(code);

  expect(TEST_OUTPUT).toStrictEqual([1, 2, 3]);
});

test("Variant #32: Work with Eval calls", async () => {
  var { code } = await JsConfuser.obfuscate(
    `
    var localVar = false;
    eval(__JS_CONFUSER_VAR__(localVar) + " = true")
    if(!localVar) {
      TEST_OUTPUT = "Incorrect Value";
    }

    if(!TEST_OUTPUT) {
      TEST_OUTPUT = "Correct Value";
    }
    `,
    {
      target: "node",
      minify: true,
    }
  );

  var TEST_OUTPUT;
  eval(code);

  expect(TEST_OUTPUT).toStrictEqual("Correct Value");
});
