import eslintPluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import * as prettier from "eslint-plugin-prettier";

export default tseslint.config({
  files: ["**/*.{ts,tsx}"],
  extends: [
    ...tseslint.configs.recommended,
    eslintPluginJs.configs.recommended,
    {
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "prettier/prettier": "off"
      },
    },
  ],
});
