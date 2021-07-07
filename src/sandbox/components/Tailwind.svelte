<style global lang="postcss">
  /* purgecss start ignore */
  @import "tailwindcss/base";
  @import "tailwindcss/components";
  /* purgecss end ignore */
  @import "tailwindcss/utilities";

  h1 {
    @apply text-5xl font-light;
    letter-spacing: -1.5px;
  }

  h2 {
    @apply text-4xl font-light;
    letter-spacing: -0.5px;
  }

  h3 {
    @apply text-3xl font-normal;
    letter-spacing: 0px;
  }

  h4 {
    @apply text-2xl font-normal;
    letter-spacing: 0.25px;
  }

  h5 {
    @apply text-xl font-normal;
    letter-spacing: 0px;
  }

  h6 {
    @apply text-base font-medium;
    letter-spacing: 0.15px;
  }

  hr {
    @apply border-t border-gray-400 border-solid;
  }

  button:focus, input:focus, li:focus, div:focus, textarea:focus, a:focus {
    @apply outline-none;
  }

  .a {
    @apply text-blue-600 transition duration-100;
  }

  .a:hover {
    @apply underline text-blue-400;
  }

  .mode-dark {
    @apply text-gray-100 bg-dark-500 duration-100 pointer-events-auto;
  }

  .text-xxs {
    font-size: 0.6rem;
  }

  .text-s {
    font-size: 0.8rem;
  }

  .blurred-bg {
    backdrop-filter: blur(2px);
  }

  .selected {
    @apply bg-dark-transDark text-black;
  }
  .mode-dark .selected {
    @apply bg-dark-transLight text-white;
  }

  svg {
    fill: currentColor;
  }
  .logo {
    font-family: 'logo';
    letter-spacing: 0.1rem;
  }
</style>
