import SandboxContent from './components/SandboxContent.svelte';

if (process.env.NODE_ENV === 'production') {
  console.debug = () => {};
}

new SandboxContent({ target: document.body });
