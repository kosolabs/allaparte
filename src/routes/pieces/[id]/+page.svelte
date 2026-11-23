<script lang="ts">
  import { page } from "$app/state";
  import Piece from "#lib/components/piece.svelte";
</script>

{#key page.params.id}
  <Piece id={page.params.id!} />
{/key}
