import resolve from '@rollup/plugin-node-resolve';  // required by svelte
import commonjs from '@rollup/plugin-commonjs';   // needed by binary-search
import svelte from 'rollup-plugin-svelte';
import modify from 'rollup-plugin-modify';
import { terser } from 'rollup-plugin-terser';
import fs from 'fs';
import sveltePreprocess from 'svelte-preprocess';
import cssExtract from 'rollup-plugin-css-only';
import postcssConfig from './postcss.config';

const production = process.env.NODE_ENV === 'production';

const env = {
  'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'staging'),
};

const makeSandbox = {
  name: 'makeSandbox',
  writeBundle(_, bundle) {
    const sandbox = fs.readFileSync('public/sandbox.html', 'utf8');

    const output = sandbox
      .replace('</body>', () => `
        <script type="module">
          ${bundle['sandbox.js'].code}
        </script>
        </body>`
      );

    fs.writeFileSync(`dist/index.html`, output);
    fs.unlinkSync('dist/sandbox.js');
  }
};

const svelteOptions = {
  extensions: ['.svelte'],
  compilerOptions: {
    dev: !production,
    hydratable: false,
    immutable: true,
    css: false
  }
}

const withPreprocess = ({ purgePaths }) => {
  const config = {
    ...svelteOptions,
    preprocess: sveltePreprocess({
      postcss: postcssConfig(
        purgePaths,
        production
      )
    }),
  };
  return config;
};


if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

export default [
  {
    input: 'src/sandbox/sandbox.js',
    plugins: [
      modify(env),
      resolve({
        browser: true,
        extensions: ['.svelte', '.js']
      }),
      commonjs(),

      svelte(withPreprocess({
        purgePaths: [
          'src/sandbox/components/*',
        ]
      })),
      cssExtract({
        output: 'sandbox.css'
      }),
      production && terser(),
      makeSandbox
    ],
    output: {
      sourcemap: !production,
      format: 'es',
      dir: 'dist',
    },
  },
  {
    input: 'src/runtime.js',
    plugins: [
      modify(env),
      resolve({ browser: true }),
      commonjs(),

      svelte(svelteOptions),
      production && terser()
    ],
    output: {
      sourcemap: !production,
      format: 'iife',
      name: 'Runtime',
      dir: 'dist',
    }
  }
];
