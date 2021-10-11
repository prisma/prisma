const globby = require("globby");
const fs = require("fs");
const path = require("path");

const ignoreFiles = globby.sync("packages/*/.eslintignore");

const ignorePatterns = flatten(
  flatten(
    ignoreFiles.map((f) => {
      const dir = path.dirname(f);
      return fs
        .readFileSync(f, "utf-8")
        .split("\n")
        .filter((l) => l.trim().length > 0)
        .map((l) => [l, `/${path.join(dir, l)}`]);
    })
  )
);

module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "jest"],
  env: {
    node: true,
    es6: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:eslint-comments/recommended",
    "plugin:jest/recommended",
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
    project: ["./packages/*/tsconfig.eslint.json"],
    // debugLevel: true,
  },
  ignorePatterns,
  overrides: [
    {
      files: ["*.ts"],
      extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/eslint-recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking",
        "plugin:prettier/recommended",
        "plugin:jest/recommended",
      ],
      rules: {
        "prettier/prettier": "warn",
        "@typescript-eslint/no-use-before-define": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        "no-useless-escape": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-var-requires": "off",
        "@typescript-eslint/no-unsafe-return": "off",
        // added at 2020/11/26
        "@typescript-eslint/no-unsafe-call": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/ban-ts-comment": "off",
        "@typescript-eslint/no-empty-function": "off",
        "eslint-comments/no-unlimited-disable": "off",
        "eslint-comments/disable-enable-pair": "off",
        "@typescript-eslint/no-misused-promises": "off",
        "jest/expect-expect": "off",
        "no-empty": "off",
        "jest/valid-title": "off",
        "@typescript-eslint/no-unnecessary-type-assertion": "off",
        // low hanging fruits:
        "@typescript-eslint/ban-types": "off",
        "@typescript-eslint/restrict-plus-operands": "off",
        "@typescript-eslint/restrict-template-expressions": "off",
        "jest/no-conditional-expect": "off",
        "jest/no-export": "off",
        "@typescript-eslint/no-empty-interface": "off",
      },
    },
  ],
  settings: {
    jest: {
      version: 26,
    },
  },
};

function flatten(input) {
  const stack = [...input];
  const res = [];
  while (stack.length) {
    // pop value from stack
    const next = stack.pop();
    if (Array.isArray(next)) {
      // push back array items, won't modify the original input
      stack.push(...next);
    } else {
      res.push(next);
    }
  }
  // reverse to restore input order
  return res.reverse();
}
