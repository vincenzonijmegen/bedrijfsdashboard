/** @type {import('eslint').Linter.FlatConfig} */
export default [
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
