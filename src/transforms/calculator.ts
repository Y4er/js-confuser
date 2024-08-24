import { PluginObj } from "@babel/core";
import { PluginArg } from "./plugin";
import * as t from "@babel/types";
import { Order } from "../order";
import { ok } from "assert";

export default ({ Plugin }: PluginArg): PluginObj => {
  const me = Plugin(Order.Calculator);

  return {
    visitor: {
      Program: {
        exit(path) {
          const allowedBinaryOperators = new Set(["+", "-", "*", "/"]);
          const allowedUnaryOperators = new Set([
            "!",
            "void",
            "typeof",
            "-",
            "~",
            "+",
          ]);

          var operatorsMap = new Map<string, string>();
          var calculatorFnName = me.getPlaceholder() + "_calc";

          path.traverse({
            UnaryExpression: {
              exit(path) {
                const { operator } = path.node;

                if (!allowedUnaryOperators.has(operator)) return;

                // Special `typeof identifier` check
                if (
                  operator === "typeof" &&
                  path.get("argument").isIdentifier()
                )
                  return;

                const mapKey = "unaryExpression_" + operator;
                let operatorKey = operatorsMap.get(mapKey);
                if (typeof operatorKey === "undefined") {
                  operatorKey = me.generateRandomIdentifier();
                  operatorsMap.set(mapKey, operatorKey);
                }

                path.replaceWith(
                  t.callExpression(t.identifier(calculatorFnName), [
                    t.stringLiteral(operatorKey),
                    path.node.argument,
                  ])
                );
              },
            },
            BinaryExpression: {
              exit(path) {
                const { operator } = path.node;

                if (t.isPrivate(path.node.left)) return;

                if (!allowedBinaryOperators.has(operator)) return;

                const mapKey = "binaryExpression_" + operator;
                let operatorKey = operatorsMap.get(mapKey);
                if (typeof operatorKey === "undefined") {
                  operatorKey = me.generateRandomIdentifier();
                  operatorsMap.set(mapKey, operatorKey);
                }

                path.replaceWith(
                  t.callExpression(t.identifier(calculatorFnName), [
                    t.stringLiteral(operatorKey),
                    path.node.left,
                    path.node.right,
                  ])
                );
              },
            },
          });

          // No operators created
          if (operatorsMap.size < 1) {
            return;
          }

          // Create the calculator function and insert into program path
          var switchCases: t.SwitchCase[] = Array.from(
            operatorsMap.entries()
          ).map(([mapKey, key]) => {
            const [type, operator] = mapKey.split("_");

            let expression: t.Expression;
            if (type === "binaryExpression") {
              expression = t.binaryExpression(
                operator as any,
                t.identifier("a"),
                t.identifier("b")
              );
            } else if (type === "unaryExpression") {
              expression = t.unaryExpression(
                operator as any,
                t.identifier("a")
              );
            } else {
              ok(false);
            }

            return t.switchCase(t.stringLiteral(key), [
              t.returnStatement(expression),
            ]);
          });

          var p = path.unshiftContainer(
            "body",
            t.functionDeclaration(
              t.identifier(calculatorFnName),
              [t.identifier("operator"), t.identifier("a"), t.identifier("b")],
              t.blockStatement([
                t.switchStatement(t.identifier("operator"), switchCases),
              ])
            )
          );

          path.scope.registerDeclaration(p[0]);
        },
      },
    },
  };
};
