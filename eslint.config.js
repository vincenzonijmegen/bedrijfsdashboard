import { next } from "@vercel/eslint-config-next";

export default [
  ...next(),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
