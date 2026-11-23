<script lang="ts">
  import { docSubscriber } from "#lib/doc-subscriber.js";
  import { Room } from "#lib/room.js";
  import { readScore } from "#lib/score.js";
  import { Alert, CircularProgress } from "kosui";
  import { onDestroy, untrack } from "svelte";
  import ScoreView from "./score-view.svelte";

  const { ensembleId, id }: { ensembleId: string; id: string } = $props();

  const room = untrack(() => new Room(id));
  onDestroy(() => room.close());

  const subscribe = docSubscriber(room.doc);
  const mnx = $derived.by(() => {
    subscribe();
    return readScore(room.doc);
  });
</script>

{#await room.ready}
  <CircularProgress class="m-auto" aria-label="Loading" />
{:then}
  {#if mnx}
    <ScoreView {mnx} {ensembleId} />
  {:else}
    <Alert color="error">This piece couldn't be loaded.</Alert>
  {/if}
{/await}
