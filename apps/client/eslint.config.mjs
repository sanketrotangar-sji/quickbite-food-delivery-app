import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const reactNativeBans = {
  name: 'react-native',
  importNames: ['Animated', 'FlatList', 'SectionList', 'Alert'],
  message:
    'Use react-native-reanimated for motion, @shopify/flash-list for lists, sonner-native toast or showDialog (@/lib/dialog) for feedback.',
};

const dataAccessBans = [
  {
    group: ['@/api/supabaseClient', '@quickbite/db', '@quickbite/db/*', '@supabase/supabase-js'],
    message: 'Screens and components talk to the backend through feature hooks / @/api/* wrappers.',
  },
];

export default tseslint.config(
  { ignores: ['node_modules', '.expo', 'android', 'ios', 'dist', 'expo-env.d.ts'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-restricted-imports': ['error', { paths: [reactNativeBans] }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['app/**/*.tsx', 'src/**/screens/**/*.tsx', 'src/**/components/**/*.tsx', 'src/components/**/*.tsx'],
    rules: {
      'no-restricted-imports': ['error', { paths: [reactNativeBans], patterns: dataAccessBans }],
      'no-restricted-syntax': [
        'warn',
        {
          selector: "CallExpression[callee.property.name='rpc'], CallExpression[callee.property.name='invoke']",
          message: 'Move .rpc( / functions.invoke( into api.ts.',
        },
        {
          selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
          message: 'Use colors from @/constants/theme instead of hex literals.',
        },
        {
          selector: "Property[key.name='fontSize'][value.type='Literal']",
          message: 'Prefer AppText variant / type scale from @/constants/theme.',
        },
      ],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node } },
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
