<script>
    import Shortcut from "./Shortcut.svelte";

    let hidden = true;

    const shortcuts = [
        {
            "group": "UI",
            "list": [
                {
                    "title": "Toggle Shortcuts",
                    "keys": ["Shift", "Alt", "?"]
                },
                {
                    "title": "Toggle Navigator",
                    "keys": ["Shift", "Alt", "."]
                },
                {
                    "title": "Switch to layout",
                    "keys": ["Alt", "1"]
                },
                {
                    "title": "Switch to sheet",
                    "keys": ["Alt", "2", "..", "9"]
                },
                {
                    "title": "Toggle dark mode",
                    "keys": ["Alt", "D"]
                },
            ]
        },
        {
            "group": "Common",
            "list": [
                {
                    "title": "Undo",
                    "keys": ["Cmd", "Z"]
                },
                {
                    "title": "Redo",
                    "keys": ["Cmd", "Shift", "Z"]
                },
                {
                    "title": "Select cells",
                    "keys": ["Shift", "←", "/", "→", "/", "↓", "/", "↑"  ]
                },
                {
                    "title": "Copy",
                    "keys": ["Cmd", "C"]
                },
                {
                    "title": "Cut",
                    "keys": ["Cmd", "X"]
                },
                {
                    "title": "Paste",
                    "keys": ["Cmd", "V"]
                },
            ]
        },
        {
            "group": "Expansion and labels",
            "list": [
                {
                    "title": "Expand / Collapse horizontally",
                    "keys": ["Shift", "Alt", "←", "/", "→"]
                },
                {
                    "title": "Expand / Collapse vertically",
                    "keys": ["Shift", "Alt", "↓", "/", "↑"]
                },
                {
                    "title": "Toggle row labels",
                    "keys": ["Shift", "Alt", "Z"]
                },
                {
                    "title": "Toggle column labels",
                    "keys": ["Shift", "Alt", "X"]
                },
            ]
        },
        {
            "group": "Insert / Delete cells",
            "list": [
                {
                    "title": "Insert column",
                    "keys": ["Space"]
                },
                {
                    "title": "Remove column",
                    "keys": ["Backspace"]
                },
                {
                    "title": "Insert row",
                    "keys": ["Shift", "Space"]
                },
                {
                    "title": "Delete row",
                    "keys": ["Shift", "Backspace"]
                },
            ]
        },
    ];
</script>

<div id="shortcuts-helper"
     class="shortcuts-helper flex flex-col dark:bg-gray-900 dark:text-white"
     class:hidden
>
    <div class="absolute top-4 right-4 p-1 h-8 w-8 stroke-current text-gray-900 dark:text-white opacity-40 hover:opacity-100"
         on:click={() => document.getElementById("shortcuts-helper").classList.toggle("hidden")}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.5 3.5L3.5 12.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12.5 12.5L3.5 3.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 w-full">
        {#each shortcuts as item}
            <div class="shortcut-list">
                <h4 class="opacity-40">{item.group}</h4>
                {#each item.list as { title, keys }}
                    <Shortcut {title} {keys}/>
                {/each}
            </div>
        {/each}
    </div>
</div>

<style>
    .hidden {
        display: none;
    }

    .shortcuts-helper {
        @apply fixed bottom-0 left-0 h-54 w-full py-4 px-48 z-50 overflow-auto
        text-xs bg-gray-100 text-gray-900;
    }

    .shortcut-list {
       @apply flex flex-col gap-2;
    }
</style>
