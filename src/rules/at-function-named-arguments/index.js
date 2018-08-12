import { utils } from "stylelint";
import {
  namespace,
  optionsHaveIgnored,
  isNativeCssFunction,
  parseFunctionArguments
} from "../../utils";
import { isString } from "lodash";
import valueParser from "postcss-value-parser";

export const ruleName = namespace("at-function-named-arguments");

export const messages = utils.ruleMessages(ruleName, {
  expected: "Expected a named parameter to be used in function call",
  rejected: "Unexpected a named parameter in function call"
});

const isScssVarRegExp = /^\$\S*/;

export default function(expectation, options) {
  return function(root, result) {
    const validOptions = utils.validateOptions(
      result,
      ruleName,
      {
        actual: expectation,
        possible: ["always", "never"]
      },
      {
        actual: options,
        possible: {
          ignore: ["single-argument"],
          ignoreFunctions: [isString]
        },
        optional: true
      }
    );
    if (!validOptions) {
      return;
    }

    const shouldIgnoreSingleArgument = optionsHaveIgnored(
      options,
      "single-argument"
    );

    root.walkDecls(decl => {
      valueParser(decl.value).walk(node => {
        if (
          node.type !== "function" ||
          isNativeCssFunction(node.value) ||
          node.value === ""
        ) {
          return;
        }

        const hasFuncIgnored =
          options &&
          options.ignoreFunctions &&
          options.ignoreFunctions.some(f => {
            const isRegex = /^\/.*\//.test(f);

            if (!isRegex) {
              return f === node.value;
            }

            const parts = f.split("/");
            return new RegExp(parts[0] || parts[1], parts[2] || "").test(
              node.value
            );
          });

        if (hasFuncIgnored) {
          return;
        }

        const args = parseFunctionArguments(decl.value);
        const isSingleArgument = args.length === 1;

        if (isSingleArgument && shouldIgnoreSingleArgument) {
          return;
        }

        args.forEach(arg => {
          switch (expectation) {
            case "never": {
              if (!arg.key) {
                return;
              }

              utils.report({
                message: messages.rejected,
                node: decl,
                result,
                ruleName
              });
              break;
            }

            case "always": {
              if (arg.key && isScssVarRegExp.test(arg.key)) {
                return;
              }

              utils.report({
                message: messages.expected,
                node: decl,
                result,
                ruleName
              });
              break;
            }
          }
        });
      });
    });
  };
}
