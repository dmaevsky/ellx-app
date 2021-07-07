export default (purgePaths, purge) => ({
  plugins: [
    require('postcss-import'),
    require('autoprefixer')(),
    require('tailwindcss'),
    purge && require('cssnano')(),
    purge && require('@fullhuman/postcss-purgecss')({
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
