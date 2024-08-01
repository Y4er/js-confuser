import { ok } from "assert";
import { ObfuscateOrder } from "../../order";
import Template from "../../templates/template";
import { isBlock } from "../../traverse";
import { isDirective, isModuleSource } from "../../util/compare";
import {
  ArrayExpression,
  CallExpression,
  FunctionExpression,
  Identifier,
  Literal,
  MemberExpression,
  Node,
  ObjectExpression,
  Property,
  VariableDeclaration,
  VariableDeclarator,
} from "../../util/gen";
import { append, prepend } from "../../util/insert";
import {
  chance,
  choice,
  getRandomInteger,
  getRandomString,
} from "../../util/random";
import Transform from "../transform";
import {
  EncodingImplementations,
  createEncodingImplementation,
  hasAllEncodings,
} from "./encoding";
import { ComputeProbabilityMap } from "../../probability";
import { BufferToStringTemplate } from "../../templates/bufferToString";
import { criticalFunctionTag, predictableFunctionTag } from "../../constants";

export default class StringConcealing extends Transform {
  arrayExpression: Node;
  set: Set<string>;
  index: { [str: string]: [number, string] };

  arrayName = this.getPlaceholder();
  ignore = new Set<string>();
  variablesMade = 1;
  encoding: { [type: string]: string } = Object.create(null);
  gen: ReturnType<Transform["getGenerator"]>;

  constructor(o) {
    super(o, ObfuscateOrder.StringConcealing);

    this.set = new Set();
    this.index = Object.create(null);
    this.arrayExpression = ArrayExpression([]);
    this.gen = this.getGenerator();

    // Pad array with useless strings
    var dead = getRandomInteger(5, 15);
    for (var i = 0; i < dead; i++) {
      var str = getRandomString(getRandomInteger(5, 40));
      var fn = this.transform(Literal(str), []);
      if (fn) {
        fn();
      }
    }
  }

  apply(tree) {
    super.apply(tree);

    var cacheName = this.getPlaceholder();
    var bufferToStringName = this.getPlaceholder() + predictableFunctionTag;

    // This helper functions convert UInt8 Array to UTf-string
    prepend(
      tree,
      ...BufferToStringTemplate.compile({
        name: bufferToStringName,
        getGlobalFnName: this.getPlaceholder() + predictableFunctionTag,
      })
    );

    Object.keys(this.encoding).forEach((type) => {
      var { template } = EncodingImplementations[type];
      var decodeFn = this.getPlaceholder() + criticalFunctionTag;
      var getterFn = this.encoding[type];

      append(
        tree,
        template.single({
          __fnName__: decodeFn,
          __bufferToString__: bufferToStringName,
        })
      );

      append(
        tree,
        Template(`
            
            function ${getterFn}(x, y, z, a = ${decodeFn}, b = ${cacheName}){
              if ( z ) {
                return y[${cacheName}[z]] = ${getterFn}(x, y);
              } else if ( y ) {
                [b, y] = [a(b), x || z]
              }
            
              return y ? x[b[y]] : ${cacheName}[x] || (z=(b[x], a), ${cacheName}[x] = z(${this.arrayName}[x]))
            }
  
            `).single()
      );
    });

    var flowIntegrity = this.getPlaceholder();

    prepend(
      tree,
      VariableDeclaration([
        VariableDeclarator(cacheName, ArrayExpression([])),
        VariableDeclarator(flowIntegrity, Literal(0)),
        VariableDeclarator(
          this.arrayName,
          CallExpression(
            FunctionExpression(
              [],
              [
                VariableDeclaration(
                  VariableDeclarator("a", this.arrayExpression)
                ),
                Template(
                  `return (${flowIntegrity} ? a["pop"]() : ${flowIntegrity}++, a)`
                ).single(),
              ]
            ),
            []
          )
        ),
      ])
    );
  }

  match(object, parents) {
    return (
      object.type == "Literal" &&
      typeof object.value === "string" &&
      object.value.length >= 3 &&
      !isModuleSource(object, parents) &&
      !isDirective(object, parents) //&&
      /*!parents.find((x) => x.$dispatcherSkip)*/
    );
  }

  transform(object: Node, parents: Node[]) {
    return () => {
      // Empty strings are discarded
      if (
        !object.value ||
        this.ignore.has(object.value) ||
        object.value.length == 0
      ) {
        return;
      }

      // Allow user to choose which strings get changed
      if (
        !ComputeProbabilityMap(
          this.options.stringConcealing,
          (x) => x,
          object.value
        )
      ) {
        return;
      }

      var encodingIdentity = choice(Object.keys(EncodingImplementations));

      if (
        !encodingIdentity ||
        (!hasAllEncodings() &&
          chance(25 / Object.keys(EncodingImplementations).length))
      ) {
        encodingIdentity = createEncodingImplementation().identity;
      }

      if (!this.encoding[encodingIdentity]) {
        this.encoding[encodingIdentity] =
          this.getPlaceholder() + predictableFunctionTag;
      }

      var fnName = this.encoding[encodingIdentity];
      var encodingImplementation = EncodingImplementations[encodingIdentity];

      var index = -1;
      if (!this.set.has(object.value)) {
        // The decode function must return correct result
        var encoded = encodingImplementation.encode(object.value);
        if (encodingImplementation.decode(encoded) !== object.value) {
          this.ignore.add(object.value);
          this.warn(encodingIdentity, object.value.slice(0, 100));
          delete EncodingImplementations[encodingIdentity];

          return;
        }

        this.arrayExpression.elements.push(Literal(encoded));
        index = this.arrayExpression.elements.length - 1;
        this.index[object.value] = [index, fnName];

        this.set.add(object.value);
      } else {
        [index, fnName] = this.index[object.value];
        ok(typeof index === "number");
      }

      ok(index != -1, "index == -1");

      var callExpr = CallExpression(Identifier(fnName), [Literal(index)]);

      // use `.apply` to fool automated de-obfuscators
      if (chance(10)) {
        callExpr = CallExpression(
          MemberExpression(Identifier(fnName), Literal("apply"), true),
          [Identifier("undefined"), ArrayExpression([Literal(index)])]
        );
      }

      // use `.call`
      else if (chance(10)) {
        callExpr = CallExpression(
          MemberExpression(Identifier(fnName), Literal("call"), true),
          [Identifier("undefined"), Literal(index)]
        );
      }

      var referenceType = "call";
      if (parents.length && chance(50 - this.variablesMade)) {
        referenceType = "constantReference";
      }

      var newExpr: Node = callExpr;

      if (referenceType === "constantReference") {
        // Define the string earlier, reference the name here
        this.variablesMade++;

        var constantReferenceType = choice(["variable", "array", "object"]);

        var place = choice(parents.filter((node) => isBlock(node)));
        if (!place) {
          this.error(new Error("No lexical block to insert code"));
        }

        switch (constantReferenceType) {
          case "variable":
            var name = this.getPlaceholder();

            prepend(
              place,
              VariableDeclaration(VariableDeclarator(name, callExpr))
            );

            newExpr = Identifier(name);
            break;
          case "array":
            if (!place.$stringConcealingArray) {
              place.$stringConcealingArray = ArrayExpression([]);
              place.$stringConcealingArrayName = this.getPlaceholder();

              prepend(
                place,
                VariableDeclaration(
                  VariableDeclarator(
                    place.$stringConcealingArrayName,
                    place.$stringConcealingArray
                  )
                )
              );
            }

            var arrayIndex = place.$stringConcealingArray.elements.length;

            place.$stringConcealingArray.elements.push(callExpr);

            var memberExpression = MemberExpression(
              Identifier(place.$stringConcealingArrayName),
              Literal(arrayIndex),
              true
            );

            newExpr = memberExpression;
            break;
          case "object":
            if (!place.$stringConcealingObject) {
              place.$stringConcealingObject = ObjectExpression([]);
              place.$stringConcealingObjectName = this.getPlaceholder();

              prepend(
                place,
                VariableDeclaration(
                  VariableDeclarator(
                    place.$stringConcealingObjectName,
                    place.$stringConcealingObject
                  )
                )
              );
            }

            var propName = this.gen.generate();
            var property = Property(Literal(propName), callExpr, true);
            place.$stringConcealingObject.properties.push(property);

            var memberExpression = MemberExpression(
              Identifier(place.$stringConcealingObjectName),
              Literal(propName),
              true
            );

            newExpr = memberExpression;
            break;
        }
      }

      this.replaceIdentifierOrLiteral(object, newExpr, parents);
    };
  }
}
