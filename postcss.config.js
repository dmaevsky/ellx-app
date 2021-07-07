import postcssImport from 'postcss-import';
import autoprefixer from 'autoprefixer';
import tailwind from 'tailwindcss';

import cssnano from 'cssnano';
import purgecss from '@fullhuman/postcss-purgecss';

export default (purgePaths, purge) => ({
  plugins: [
    postcssImport,
    autoprefixer(),
    tailwind,
    purge && cssnano(),
    purge && purgecss({
      content: purgePaths,

      whitelistPatterns: [/svelte-/, /#md/],
      whitelist: ['html', 'body'],

      defaultExtractor: e => [
        ...(e.match(/[A-Za-z0-9-_:/]+/g) || []),
        ...(e.match(/class:[A-Za-z0-9-_:]+/g) || [])
          .map(c => c.replace('class:', ''))
      ],
    })
  ].filter(Boolean)
});
