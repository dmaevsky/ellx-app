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
            {key}
        {:else}
            <kbd class="kbd">{key === "Cmd" ? `${switchCmd}` : key}</kbd>
        {/if}
    {/each}
</div>

<style>
    .shortcut {
        @apply flex flex-row content-center items-baseline justify-between gap-1;
    }

    .kbd {
        @apply px-1 border border-blue-400 text-blue-600 text-xs rounded-sm;
    }
</style>