<script lang="ts">
  import { scoreEngine } from "#lib/engine.js";
  import { readMetadata } from "#lib/metadata.js";
  import { toReaderPresentation } from "#lib/reader-presentation.js";
  import type { Json } from "#lib/json.js";
  import type { DisplayList, Engine, LayoutWorker } from "#viritura/engine";
  import { Alert, Button, CircularProgress } from "kosui";
  import { resolve } from "$app/paths";
  import { ArrowLeft } from "@lucide/svelte";
  import ScorePage from "./score-page.svelte";

  const { mnx, ensembleId }: { mnx: Json; ensembleId: string } = $props();

  let width = $state(0);
  let scoreIndex = $state(0);
  let engine = $state.raw<Engine>();
  let worker = $state.raw<LayoutWorker>();
  let layout = $state.raw<DisplayList>();
  let error = $state<string>();

  const reader = $derived(toReaderPresentation(mnx));
  const scores = $derived((mnx.scores ?? []) as { name?: string }[]);
  const pages = $derived(engine && layout ? engine.measure(layout).pages : []);

  $effect(() => {
    let current: LayoutWorker | undefined;
    let closed = false;
    scoreEngine().then(
      (loaded) => {
        if (closed) return;
        engine = loaded;
        worker = current = loaded.createLayoutWorker();
      },
      (cause) => (error = String(cause)),
    );
    return () => {
      closed = true;
      current?.dispose();
    };
  });

  $effect(() => {
    if (!worker || !width) return;
    let stale = false;
    worker.layout(reader, { pageWidth: width, scoreIndex }).then(
      (result) => {
        if (stale) return;
        layout = result;
        error = undefined;
      },
      (cause) => {
        if (!stale) error = String(cause);
      },
    );
    return () => (stale = true);
  });
</script>

<header class="flex items-center gap-2 p-2">
  <Button
    href={resolve("/e/[ensemble]", { ensemble: ensembleId })}
    icon={ArrowLeft}
    aria-label="All pieces"
    variant="plain"
  />
  <h1 class="grow truncate text-lg">{readMetadata(mnx).title ?? "Untitled"}</h1>
  {#if scores.length > 1}
    <select
      aria-label="Part"
      class="rounded border p-1"
      bind:value={scoreIndex}
    >
      {#each scores as score, index (index)}
        <option value={index}>{score.name ?? `Score ${index + 1}`}</option>
      {/each}
    </select>
  {/if}
</header>

{#if error}<Alert color="error">{error}</Alert>{/if}
<main bind:clientWidth={width}>
  {#if engine && layout}
    {#each pages as page (page.index)}
      <ScorePage {engine} {layout} {page} />
    {/each}
  {:else if !error}
    <CircularProgress class="m-auto" aria-label="Loading" />
  {/if}
</main>
