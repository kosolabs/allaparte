<script lang="ts">
  import { page } from "$app/state";
  import Ensemble from "#lib/components/ensemble.svelte";
</script>

{#key page.params.ensemble}
  <Ensemble id={page.params.ensemble!} />
{/key}
