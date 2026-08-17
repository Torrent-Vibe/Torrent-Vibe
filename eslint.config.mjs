import { defineConfig } from '@lobehub/eslint-config'
import * as jsoncParser from 'jsonc-eslint-parser'

import checkI18nJson from './plugins/eslint/eslint-check-i18n-json.js'
import recursiveSort from './plugins/eslint/eslint-recursive-sort.js'

export default defineConfig(
  {
    ignores: [
      'release/**',
      'Release/**',
      'native/**',
      'apps/helper-go/**',
      'apps/ios/**',
      'portal/**',
      '.worktrees/**',
      '**/generated-routes.ts',
    ],
    react: 'vite',
    reactCompiler: false,
    regexp: false,
    typescript: true,
    yml: false,
  },
  {
    rules: {
      'unicorn/prefer-math-trunc': 'off',
      '@eslint-react/no-clone-element': 0,
      '@eslint-react/hooks-extra/no-direct-set-state-in-use-effect': 0,
      'no-restricted-syntax': 0,
      'no-restricted-globals': [
        'error',
        {
          name: 'location',
          message:
            'Since you don\'t use the same router instance in electron and browser, you can\'t use the global location to get the route info. \n\n'
            + 'You can use `useLocaltion` or `getReadonlyRoute` to get the route info.',
        },
      ],
    },
  },
  {
    files: ['**/*.tsx'],
    rules: {
      'react/self-closing-comp': 'error',
    },
  },
  {
    files: ['**/*.cjs', 'layer/main/preload/**'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['locales/**/*.json'],
    languageOptions: {
      parser: jsoncParser,
    },
    plugins: {
      'recursive-sort': recursiveSort,
      'check-i18n-json': checkI18nJson,
    },
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
      'recursive-sort/recursive-sort': 'error',
      'check-i18n-json/valid-i18n-keys': 'error',
      'check-i18n-json/no-extra-keys': 'error',
    },
  },
)
