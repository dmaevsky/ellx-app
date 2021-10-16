<script>
    export let
        title,
        keys = [];
    const switchCmd = navigator.userAgent.includes("Mac") ? "Cmd" : "Ctrl";
</script>

<div class="shortcut">
    <p class="flex-grow">{title}</p>
    {#each keys as key}
        {#if key === ".." || key === "/" }
            <p className="opacity-60">{key}</p>
        {:else}
            <kbd class="kbd dark:border-white dark:border-opacity-40">{key === "Cmd" ? `${switchCmd}` : key}</kbd>
        {/if}
    {/each}
</div>

<style>
    .shortcut {
        @apply flex flex-row content-center items-baseline justify-between gap-1;
    }

    .kbd {
        @apply px-1 border border-gray-900 border-opacity-40 text-xs rounded-sm;
    }
</style>