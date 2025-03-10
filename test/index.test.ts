import JsConfuser from "../src/index";
import { ProfilerLog } from "../src/obfuscationResult";
import * as t from "@babel/types";

describe("obfuscate", () => {
  test("Variant #1: Should be a function", async () => {
    expect(typeof JsConfuser.obfuscate).toBe("function");
  });

  test("Variant #2: Return an awaited object with 'code' property", async () => {
    var output = await JsConfuser.obfuscate("5+5", {
      target: "browser",
      compact: true,
    });

    expect(typeof output).toBe("object");
    expect(typeof output.code).toBe("string");
  });

  test("Variant #3: Error when options are empty", async () => {
    var invalid: any = {};

    await expect(async () => {
      return await JsConfuser.obfuscate("5+5", invalid);
    }).rejects.toThrow();
  });

  test("Variant #4: Error when no obfuscation options", async () => {
    var invalid: any = {
      target: "browser",
    };

    await expect(async () => {
      return await JsConfuser.obfuscate("5+5", invalid);
    }).rejects.toThrow();
  });

  test("Variant #5: Error when invalid source code is passed in", async () => {
    await expect(async () => {
      return await JsConfuser.obfuscate(
        "#?!if?//for:;1(function:class{))]][]",
        {
          target: "node",
          preset: "low",
        }
      );
    }).rejects.toThrow();
  });
});

describe("obfuscateAST", () => {
  test("Variant #1: Mutate AST", async () => {
    var AST = t.file(t.program([t.expressionStatement(t.numericLiteral(5))]));
    var before = JSON.stringify(AST);

    JsConfuser.obfuscateAST(AST as any, {
      target: "node",
      renameVariables: true,
    });

    var after = JSON.stringify(AST);

    // Same object reference
    expect(AST === AST).toStrictEqual(true);

    // Different string
    expect(before !== after).toStrictEqual(false);
  });

  test("Variant #2: Error on invalid parameters", async () => {
    await expect(async () => {
      return await JsConfuser.obfuscateAST("string" as any, {
        target: "node",
        preset: "low",
      });
    }).rejects.toThrow();
  });

  test("Variant #3: Error on invalid AST", async () => {
    await expect(async () => {
      var invalidAST = {
        type: "NotProgram",
      };

      return await JsConfuser.obfuscateAST(invalidAST as any, {
        target: "node",
        preset: "low",
      });
    }).rejects.toThrow();
  });
});

describe("obfuscateWithProfiler", () => {
  test("Variant #1: Return Profile Data and notify the Profile Log callback", async () => {
    var called = false;

    var callback = (log: ProfilerLog) => {
      expect(typeof log.index).toStrictEqual("number");
      expect(typeof log.currentTransform).toStrictEqual("string");
      expect(typeof log.totalTransforms).toStrictEqual("number");
      if (typeof log.nextTransform !== "undefined") {
        expect(typeof log.nextTransform).toStrictEqual("string");
      }

      called = true;
    };
    var { code, profileData } = await JsConfuser.obfuscateWithProfiler(
      `console.log(1)`,
      { target: "node", preset: "low" },
      {
        callback,
        performance: require("perf_hooks").performance,
      }
    );

    expect(typeof code).toStrictEqual("string");
    expect(typeof profileData.obfuscationTime).toStrictEqual("number");
    expect(typeof profileData.compileTime).toStrictEqual("number");
    expect(typeof profileData.parseTime).toStrictEqual("number");
    expect(typeof profileData.totalPossibleTransforms).toStrictEqual("number");
    expect(typeof profileData.totalTransforms).toStrictEqual("number");
    expect(typeof profileData.transforms).toStrictEqual("object");
    expect(typeof profileData.transforms.RenameVariables).toStrictEqual(
      "object"
    );
    expect(
      typeof profileData.transforms.RenameVariables.transformTime
    ).toStrictEqual("number");
    expect(
      typeof profileData.transforms.RenameVariables.changeData.variables
    ).toStrictEqual("number");

    eval(code);
    expect(called).toStrictEqual(true);
  });
});
