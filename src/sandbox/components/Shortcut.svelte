<script>
    export let
        title,
        keys = [];

    const switchCmd = navigator.userAgent.includes("Mac") ? "Cmd" : "Ctrl";
</script>

<div class="shortcut">
    <p class="flex-grow">{title}</p>
    <p class="flex flex-row gap-1">
    {#each keys as key}
        {#if key === ".." || key === "/" }
            <span class="opacity-40">{key}</span>
        {:else if key === "//" }
            <kbd class="kbd dark:border dark:border-white dark:border-opacity-40">/</kbd>
        {:else}
            <kbd class="kbd dark:border dark:border-white dark:border-opacity-40">{key === "Cmd" ? `${switchCmd}` : key}</kbd>
        {/if}
    {/each}
    </p>
</div>

<style>
    .shortcut {
        @apply flex flex-row content-center items-baseline justify-between gap-4;
    }

    .kbd {
        @apply px-1 border border-gray-900 border-opacity-40 text-xs rounded-sm;
    }
</style>