import { writeFileSync } from "fs";
import JsConfuser from "../../src/index";

test("Variant #1: Convert Function Declaration into 'eval' code", async () => {
  var { code: output } = await JsConfuser.obfuscate(
    `
    function addTwoNumbers(a, b){
      return a + b;
    }
    
    TEST_OUTPUT = addTwoNumbers(10, 5);
    `,
    {
      target: "node",
      rgf: true,
    }
  );

  expect(output).toContain("_rgf_eval");

  var TEST_OUTPUT;
  eval(output);

  expect(TEST_OUTPUT).toStrictEqual(15);
});

test("Variant #2: Convert Function Expression into 'eval' code", async () => {
  var { code: output } = await JsConfuser.obfuscate(
    `
    var addTwoNumbers = function(a, b){
      return a + b;
    }
    
    TEST_OUTPUT = addTwoNumbers(10, 5);
    `,
    {
      target: "node",
      rgf: true,
    }
  );

  expect(output).toContain("_rgf_eval(");

  var TEST_OUTPUT;
  eval(output);

  expect(TEST_OUTPUT).toStrictEqual(15);
});

test("Variant #3: Convert functions that use global variables", async () => {
  var { code: output } = await JsConfuser.obfuscate(
    `
    function floorNumber(num){
      return Math.floor(num);
    }
    
    TEST_OUTPUT = floorNumber(1.9);
    `,
    {
      target: "node",
      rgf: true,
    }
  );

  expect(output).toContain("eval");

  var TEST_OUTPUT;
  eval(output);

  expect(TEST_OUTPUT).toStrictEqual(1);
});

test("Variant #4: Don't convert functions that rely on outside-scoped variables", async () => {
  var { code: output } = await JsConfuser.obfuscate(
    `
    var _Math = Math;

    function floorNumber(num){
      return _Math.floor(num);
    }
    
    TEST_OUTPUT = floorNumber(1.9);
    `,
    {
      target: "node",
      rgf: true,
    }
  );

  expect(output).not.toContain("eval");

  var TEST_OUTPUT;
  eval(output);

  expect(TEST_OUTPUT).toStrictEqual(1);
});

test("Variant #5: Don't convert functions that rely on outside-scoped variables (trap)", async () => {
  var { code: output } = await JsConfuser.obfuscate(
    `
    var _Math = Math;

    function floorNumber(num){
      (()=>{
        var _Math;
      })();
      return _Math.floor(num);
    }
    
    TEST_OUTPUT = floorNumber(1.9);
    `,
    {
      target: "node",
      rgf: true,
    }
  );

  expect(output).not.toContain("eval");

  var TEST_OUTPUT;
  eval(output);

  expect(TEST_OUTPUT).toStrictEqual(1);
});

test("Variant #6: Work on High Preset", async () => {
  var { code } = await JsConfuser.obfuscate(
    `
    function addTwoNumbers(a, b){
      return a + b;
    }
    
    TEST_OUTPUT = addTwoNumbers(10, 5);
    `,
    {
      target: "node",
      preset: "high",
      rgf: true,
      pack: true,
    }
  );

  var TEST_OUTPUT;
  eval(code);

  expect(TEST_OUTPUT).toStrictEqual(15);
});

test("Variant #7: Don't convert arrow, async, or generator functions", async () => {
  var { code: output } = await JsConfuser.obfuscate(
    `
    var arrowFunction = ()=>{};
    async function asyncFunction(){

    };
    function* generatorFunction(){
      yield "Correct Value";
    };

    TEST_OUTPUT = generatorFunction().next().value;
    `,
    {
      target: "node",
      rgf: true,
    }
  );

  expect(output).not.toContain("eval");

  var TEST_OUTPUT;
  eval(output);

  expect(TEST_OUTPUT).toStrictEqual("Correct Value");
});

test("Variant #8: Modified Function", async () => {
  var { code: output } = await JsConfuser.obfuscate(
    `
    function addTwoNumbers(x,y){
      return x + y;
    }

    addTwoNumbers = function(){
      return "Incorrect Value";
    }

    addTwoNumbers = ()=>{
      return "Correct Value";
    }

    TEST_OUTPUT = addTwoNumbers(10, 5);
    `,
    {
      target: "node",
      rgf: true,
    }
  );

  expect(output).toContain("eval");

  var TEST_OUTPUT;
  eval(output);

  expect(TEST_OUTPUT).toStrictEqual("Correct Value");
});

test("Variant #8: Modified Function (non function value)", async () => {
  var { code: output } = await JsConfuser.obfuscate(
    `
    function addTwoNumbers(x,y){
      return x+y;
    }

    addTwoNumbers = "Correct Value";

    TEST_OUTPUT = addTwoNumbers;
    `,
    {
      target: "node",
      rgf: true,
    }
  );

  expect(output).toContain("eval");

  var TEST_OUTPUT;
  eval(output);

  expect(TEST_OUTPUT).toStrictEqual("Correct Value");
});

test("Variant #9: Work with Flatten on any function", async () => {
  var { code: output } = await JsConfuser.obfuscate(
    `
    var outsideCounter = 0;
    var outsideFlag = false;
    var TEST_OUTPUT

    function incrementOutsideCounter(){
      outsideCounter++;
    }

    function incrementTimes(times){
      for( var i = 0; i < times; i++ ) {
        incrementOutsideCounter();
      }
      if( outsideFlag ) {
        TEST_OUTPUT = times === 1 && outsideCounter === 10 ? "Correct Value" : "Incorrect Value";
      } 
      outsideFlag = true;
    }

    incrementOutsideCounter();
    incrementTimes(8);
    incrementTimes(1); 

    TEST_OUTPUT_OUT = TEST_OUTPUT;
    `,
    {
      target: "node",
      rgf: true,
      flatten: true,
    }
  );

  expect(output).toContain("eval");

  var TEST_OUTPUT_OUT;
  eval(output);

  expect(TEST_OUTPUT_OUT).toStrictEqual("Correct Value");
});

test("Variant #10: Configurable by custom function option", async () => {
  var functionNames: string[] = [];

  var { code: output } = await JsConfuser.obfuscate(
    `
  function rgfThisFunction(){
    return true;
  }
  
  function doNotRgfThisFunction(){
    return true;
  }

  TEST_OUTPUT_1 = rgfThisFunction();
  TEST_OUTPUT_2 = doNotRgfThisFunction();
  `,
    {
      target: "node",
      rgf: (name) => {
        functionNames.push(name);
        return name !== "doNotRgfThisFunction";
      },
      pack: true,
    }
  );

  expect(functionNames).toStrictEqual([
    "rgfThisFunction",
    "doNotRgfThisFunction",
  ]);
  expect(output).toContain("eval");

  expect(output).not.toContain("rgfThisFunction(){return true");
  expect(output).toContain("doNotRgfThisFunction(){return true");

  var TEST_OUTPUT_1;
  var TEST_OUTPUT_2;

  eval(output);
  expect(TEST_OUTPUT_1).toStrictEqual(true);
  expect(TEST_OUTPUT_2).toStrictEqual(true);
});

test("Variant #11: Functions containing functions should only transform the parent function", async function () {
  var fnNamesCollected: string[] = [];

  var { code: output } = await JsConfuser.obfuscate(
    `
    function FunctionA(){
      function FunctionB(){
        var bVar = 10;
        return bVar
      }

      var bFn = FunctionB;
      var aVar = bFn();
      return aVar + 1
    }

    TEST_OUTPUT = FunctionA();
  `,
    {
      target: "node",
      rgf: (fnName) => {
        fnNamesCollected.push(fnName);

        return true;
      },
    }
  );

  // Ensure only FunctionA was transformed
  expect(fnNamesCollected).toContain("FunctionA");
  expect(fnNamesCollected).not.toContain("FunctionB");

  // Only the most parent function should be changed
  expect(output.split('_rgf_eval("').length).toStrictEqual(2);

  var TEST_OUTPUT;
  eval(output);

  expect(TEST_OUTPUT).toStrictEqual(11);
});

test("Variant #12: Preserve Function.length", async function () {
  var { code: output } = await JsConfuser.obfuscate(
    `
  function myFunction(a,b,c,d = ""){ // Function.length = 3

  }

  function oneParam(a){} // Function.length = 1

  myFunction()
  TEST_OUTPUT = myFunction.length + oneParam.length
  `,
    {
      target: "node",
      rgf: true,
    }
  );

  var TEST_OUTPUT;
  eval(output);

  expect(TEST_OUTPUT).toStrictEqual(4);
});
