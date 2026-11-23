<script lang="ts">
  import { page } from "$app/state";
  import Piece from "#lib/components/piece.svelte";
</script>

{#key page.params.piece}
  <Piece ensembleId={page.params.ensemble!} id={page.params.piece!} />
{/key}
