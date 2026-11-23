<script lang="ts">
  import { openScore, readScore } from "#lib/documents.js";
  import { Alert, CircularProgress } from "kosui";
  import { onDestroy, untrack } from "svelte";
  import ScoreView from "./score-view.svelte";

  const { id }: { id: string } = $props();

  const { doc, loaded } = openScore(untrack(() => id));
  onDestroy(() => doc.destroy());
</script>

{#await loaded}
  <CircularProgress class="m-auto" aria-label="Loading" />
{:then}
  {@const mnx = readScore(doc)}
  {#if mnx}
    <ScoreView {mnx} />
  {:else}
    <Alert color="error">This piece isn't on this device.</Alert>
  {/if}
{/await}
