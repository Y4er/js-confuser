import { PluginObj } from "@babel/core";
import { NodePath } from "@babel/traverse";
import { PluginArg } from "./plugin";
import * as t from "@babel/types";
import { Order } from "../order";
import path from "path";
import {
  NodeSymbol,
  PREDICTABLE,
  UNSAFE,
  variableFunctionName,
} from "../constants";
import { ok } from "assert";
import {
  getParentFunctionOrProgram,
  getPatternIdentifierNames,
} from "../utils/ast-utils";
import { isVariableFunctionIdentifier } from "../utils/function-utils";

export default ({ Plugin }: PluginArg): PluginObj => {
  const me = Plugin(Order.Preparation);

  const markFunctionUnsafe = (path: NodePath<t.Node>) => {
    const functionPath = path.findParent(
      (path) => path.isFunction() || path.isProgram()
    );
    if (!functionPath) return;

    const functionNode = functionPath.node;

    (functionNode as NodeSymbol)[UNSAFE] = true;
  };

  return {
    visitor: {
      "ThisExpression|Super": {
        exit(path) {
          markFunctionUnsafe(path);
        },
      },

      // `Hello ${username}` -> "Hello " + username
      TemplateLiteral: {
        exit(path) {
          // Check if this is a tagged template literal, if yes, skip it
          if (t.isTaggedTemplateExpression(path.parent)) {
            return;
          }

          const { quasis, expressions } = path.node;

          // Start with the first quasi (template string part)
          let binaryExpression: t.Expression = t.stringLiteral(
            quasis[0].value.cooked
          );

          // Loop over the remaining quasis and expressions, concatenating them
          for (let i = 0; i < expressions.length; i++) {
            // Add the expression as part of the binary concatenation
            binaryExpression = t.binaryExpression(
              "+",
              binaryExpression,
              expressions[i] as t.Expression
            );

            // Add the next quasi (template string part)
            if (quasis[i + 1].value.cooked !== "") {
              binaryExpression = t.binaryExpression(
                "+",
                binaryExpression,
                t.stringLiteral(quasis[i + 1].value.cooked)
              );
            }
          }

          // Replace the template literal with the constructed binary expression
          path.replaceWith(binaryExpression);
        },
      },

      // /Hello World/g -> new RegExp("Hello World", "g")
      RegExpLiteral: {
        exit(path) {
          const { pattern, flags } = path.node;

          // Create a new RegExp() expression using the pattern and flags
          const newRegExpCall = t.newExpression(
            t.identifier("RegExp"), // Identifier for RegExp constructor
            [
              t.stringLiteral(pattern), // First argument: the pattern (no extra escaping needed)
              flags ? t.stringLiteral(flags) : t.stringLiteral(""), // Second argument: the flags (if any)
            ]
          );

          // Replace the literal regex with the new RegExp() call
          path.replaceWith(newRegExpCall);
        },
      },

      ReferencedIdentifier: {
        exit(path) {
          const { name } = path.node;
          if (["arguments", "eval"].includes(name)) {
            markFunctionUnsafe(path);
          }

          // When Rename Variables is disabled, __JS_CONFUSER_VAR__ must still be removed
          if (
            !me.obfuscator.getPlugin(Order.RenameVariables) &&
            isVariableFunctionIdentifier(path)
          ) {
            ok(
              path.parentPath.isCallExpression(),
              variableFunctionName + " must be directly called"
            );

            var argument = path.parentPath.node.arguments[0];
            t.assertIdentifier(argument);

            // Remove the variableFunctionName call
            path.parentPath.replaceWith(t.stringLiteral(argument.name));
          }
        },
      },

      FunctionDeclaration: {
        exit(path) {
          // A function is 'predictable' if the parameter lengths are guaranteed to be known
          // a(true) -> predictable
          // (a || b)(true) -> unpredictable (Must be directly in a Call Expression)
          // a(...args) -> unpredictable (Cannot use SpreadElement)

          const { name } = path.node.id;

          var binding = path.scope.getBinding(name);
          var predictable = true;
          var maxArgLength = 0;

          for (var referencePath of binding.referencePaths) {
            if (!referencePath.parentPath.isCallExpression()) {
              predictable = false;
              break;
            }

            var argsPath = referencePath.parentPath.get("arguments");
            for (var arg of argsPath) {
              if (arg.isSpreadElement()) {
                predictable = false;
                break;
              }
            }

            if (argsPath.length > maxArgLength) {
              maxArgLength = argsPath.length;
            }
          }

          var definedArgLength = path.get("params").length;
          if (predictable && definedArgLength >= maxArgLength) {
            (path.node as NodeSymbol)[PREDICTABLE] = true;
          }
        },
      },

      // console.log() -> console["log"]();
      MemberExpression: {
        exit(path) {
          if (!path.node.computed && path.node.property.type === "Identifier") {
            path.node.property = t.stringLiteral(path.node.property.name);
            path.node.computed = true;
          }
        },
      },

      // { key: true } -> { "key": true }
      "Property|Method": {
        exit(_path) {
          let path = _path as NodePath<t.Property | t.Method>;

          if (t.isClassPrivateProperty(path.node)) return;

          if (!path.node.computed && path.node.key.type === "Identifier") {
            // Don't change constructor key
            if (t.isClassMethod(path.node) && path.node.kind === "constructor")
              return;

            path.node.key = t.stringLiteral(path.node.key.name);
            path.node.computed = true;
          }
        },
      },

      // var a,b,c -> var a; var b; var c;
      VariableDeclaration: {
        exit(path) {
          if (path.node.declarations.length > 1) {
            // E.g. for (var i = 0, j = 1;;)
            if (path.key === "init" && path.parentPath.isForStatement()) {
              if (
                !path.parentPath.node.test &&
                !path.parentPath.node.update &&
                path.node.kind === "var"
              ) {
                path.parentPath.insertBefore(
                  path.node.declarations.map((declaration) =>
                    t.variableDeclaration(path.node.kind, [declaration])
                  )
                );
                path.remove();
              }
            } else {
              if (path.parentPath.isExportNamedDeclaration()) {
                path.parentPath.replaceWithMultiple(
                  path.node.declarations.map((declaration) =>
                    t.exportNamedDeclaration(
                      t.variableDeclaration(path.node.kind, [declaration])
                    )
                  )
                );
              } else {
                path
                  .replaceWithMultiple(
                    path.node.declarations.map((declaration, i) => {
                      var names = getPatternIdentifierNames(
                        path.get("declarations")[i]
                      );
                      names.forEach((name) => {
                        path.scope.removeBinding(name);
                      });

                      var newNode = t.variableDeclaration(path.node.kind, [
                        declaration,
                      ]);
                      return newNode;
                    })
                  )
                  .forEach((newPath) => {
                    if (newPath.node.kind === "var") {
                      var functionOrProgram =
                        getParentFunctionOrProgram(newPath);
                      functionOrProgram.scope.registerDeclaration(newPath);
                    }
                    newPath.scope.registerDeclaration(newPath);
                  });
              }
            }
          }
        },
      },

      // () => a() -> () => { return a(); }
      ArrowFunctionExpression: {
        exit(path: NodePath<t.ArrowFunctionExpression>) {
          if (path.node.body.type !== "BlockStatement") {
            path.node.expression = false;
            path.node.body = t.blockStatement([
              t.returnStatement(path.node.body),
            ]);
          }
        },
      },

      // if (a) b() -> if (a) { b(); }
      // if (a) {b()} else c() -> if (a) { b(); } else { c(); }
      IfStatement: {
        exit(path) {
          if (path.node.consequent.type !== "BlockStatement") {
            path.node.consequent = t.blockStatement([path.node.consequent]);
          }

          if (
            path.node.alternate &&
            path.node.alternate.type !== "BlockStatement"
          ) {
            path.node.alternate = t.blockStatement([path.node.alternate]);
          }
        },
      },

      // for() d() -> for() { d(); }
      // while(a) b() -> while(a) { b(); }
      // with(a) b() -> with(a) { b(); }
      "ForStatement|ForInStatement|ForOfStatement|WhileStatement|WithStatement":
        {
          exit(_path) {
            var path = _path as NodePath<
              | t.ForStatement
              | t.ForInStatement
              | t.ForOfStatement
              | t.WhileStatement
              | t.WithStatement
            >;

            if (path.node.body.type !== "BlockStatement") {
              path.node.body = t.blockStatement([path.node.body]);
            }
          },
        },

      // function a(param = ()=>b)
      // _getB = ()=> ()=>b
      // function a(param = _getB())
      // Basically Babel scope.rename misses this edge case, so we need to manually handle it
      // Here were essentially making the variables easier to understand
      Function: {
        exit(path) {
          for (var param of path.get("params")) {
            param.traverse({
              "FunctionExpression|ArrowFunctionExpression"(_innerPath) {
                let innerPath = _innerPath as NodePath<
                  t.FunctionExpression | t.ArrowFunctionExpression
                >;
                const child = innerPath.find((path) =>
                  path.parentPath?.isAssignmentPattern()
                );

                if (!child) return;

                if (
                  t.isAssignmentPattern(child.parent) &&
                  child.parent.right === child.node
                ) {
                  var creatorName = me.getPlaceholder();
                  var insertPath = path.insertBefore(
                    t.variableDeclaration("const", [
                      t.variableDeclarator(
                        t.identifier(creatorName),
                        t.arrowFunctionExpression([], innerPath.node, false)
                      ),
                    ])
                  )[0];

                  path.scope.parent.registerDeclaration(insertPath);

                  innerPath.replaceWith(
                    t.callExpression(t.identifier(creatorName), [])
                  );
                }
              },
            });
          }
        },
      },
    },
  };
};
