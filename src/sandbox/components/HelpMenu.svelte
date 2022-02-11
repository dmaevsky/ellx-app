<script>
  import { nodeNavigatorOpen, shortcutsHelperOpen, contextMenuOpen } from '../store.js';
  import { shortcuts } from "../../utils/shortcuts.js";
  import Shortcut from "./Shortcut.svelte";

  let hidden = true;

  function getShortcutByTitle(str) {
    return shortcuts.find(i => i.title === str).keys;
  }

</script>

<div class="fixed z-40 bottom-4 right-4 flex flex-col gap-4 items-end"
   on:mouseleave={() => {hidden = true}}
   on:mousedown={(e) => {
     e.preventDefault()
     contextMenuOpen.set(false);
   }}
   on:contextmenu={(e) => e.preventDefault()}
>
  <ul
    class="py-2 rounded-sm bg-gray-100 text-gray-900 border border-gray-500 border-opacity-20 text-xs
          flex flex-col dark:bg-gray-900 dark:text-white"
    class:hidden
  >
    <li class="px-4 py-1 hover:bg-blue-600 hover:text-white cursor-default"
        on:click={() => nodeNavigatorOpen.update(value => !value)}>
        <Shortcut title="Toggle Node Navigator" keys={getShortcutByTitle("Toggle Node Navigator")}/>
    </li>
    <li class="px-4 py-1 hover:bg-blue-600 hover:text-white cursor-default"
        on:click={() => shortcutsHelperOpen.update(value => !value)}>
        <Shortcut title="Toggle Shortcuts" keys={getShortcutByTitle("Toggle Shortcuts")}/>
    </li>
    <li class="px-4 py-1 hover:bg-blue-600 hover:text-white cursor-default">
        <a href="https://docs.ellx.app/" target="_blank" class="w-full cursor-default block">Documentation</a>
    </li>
    <li class="px-4 py-1 hover:bg-blue-600 hover:text-white cursor-default">
        <a href="https://ellx.io/explore" target="_blank" class="w-full cursor-default block">Explore</a>
    </li>
  </ul>
    <div
      class="z-50 opacity-40 flex flex-col items-center justify-around text-center p-1 h-8 w-8 rounded-full
            bg-gray-100 fill-current text-gray-900 border border-gray-900
            focus:outline-none hover:opacity-100 dark:bg-gray-900 dark:fill-current dark:text-white dark:border-white"
      class:opacity-100={!hidden}
      on:click={() => {hidden = !hidden}}
    >
        <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
            <path d="M8.18178 12.5711C8.61213 12.5711 8.961 12.2222 8.961 11.7919C8.961 11.3615 8.61213 11.0126 8.18178 11.0126C7.75143 11.0126 7.40256 11.3615 7.40256 11.7919C7.40256 12.2222 7.75143 12.5711 8.18178 12.5711Z" />
            <path fill-rule="evenodd" clip-rule="evenodd" d="M7.15553 3.70414C7.64557 3.50116 8.18479 3.44805 8.70502 3.55153C9.22524 3.65501 9.70309 3.91043 10.0781 4.28549C10.4532 4.66055 10.7086 5.1384 10.8121 5.65862C10.9156 6.17885 10.8625 6.71807 10.6595 7.20811C10.4565 7.69815 10.1128 8.11699 9.67176 8.41167C9.3709 8.6127 9.03398 8.74979 8.68182 8.81662V8.98702C8.68182 9.26316 8.45796 9.48702 8.18182 9.48702C7.90568 9.48702 7.68182 9.26316 7.68182 8.98702V8.36364C7.68182 8.23103 7.7345 8.10386 7.82826 8.01009C7.92203 7.91632 8.04921 7.86364 8.18182 7.86364C8.51445 7.86364 8.83961 7.765 9.11619 7.5802C9.39276 7.3954 9.60832 7.13274 9.73562 6.82543C9.86291 6.51811 9.89621 6.17996 9.83132 5.85371C9.76643 5.52747 9.60625 5.2278 9.37104 4.99259C9.13584 4.75739 8.83616 4.59721 8.50992 4.53232C8.18368 4.46742 7.84553 4.50073 7.53821 4.62802C7.2309 4.75532 6.96824 4.97088 6.78344 5.24745C6.59864 5.52403 6.5 5.84919 6.5 6.18182C6.5 6.45796 6.27614 6.68182 6 6.68182C5.72386 6.68182 5.5 6.45796 5.5 6.18182C5.5 5.65141 5.65729 5.13291 5.95197 4.69188C6.24665 4.25086 6.66549 3.90712 7.15553 3.70414Z" />
        </svg>
    </div>
</div>
