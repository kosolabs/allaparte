<script lang="ts">
  import { resolve } from "$app/paths";
  import { importScore } from "#lib/import-score.js";
  import { library } from "#lib/library.svelte.js";
  import type { MnxDiagnostic } from "#viritura/musicxml";
  import { Alert, Button } from "kosui";
  import { Upload } from "@lucide/svelte";

  interface Report {
    file: string;
    error?: string;
    diagnostics: readonly MnxDiagnostic[];
  }

  let input: HTMLInputElement;
  let importing = $state(false);
  let reports = $state.raw<Report[]>([]);

  async function importFiles(files: Iterable<File>) {
    importing = true;
    reports = [];
    for (const file of files) reports = [...reports, await importFile(file)];
    importing = false;
  }

  async function importFile(file: File): Promise<Report> {
    try {
      const { mnx, diagnostics } = await importScore(file);
      await library.add(mnx, file.name.replace(/\.[^.]+$/, ""));
      return { file: file.name, diagnostics };
    } catch (cause) {
      console.error(`Importing ${file.name} failed`, cause);
      return { file: file.name, error: String(cause), diagnostics: [] };
    }
  }

  function chooseFiles() {
    const files = [...(input.files ?? [])];
    input.value = "";
    return importFiles(files);
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer?.files.length)
      importFiles([...event.dataTransfer.files]);
  }
</script>

<svelte:window ondragover={(event) => event.preventDefault()} ondrop={drop} />

<main class="mx-auto flex max-w-2xl flex-col gap-4 p-4">
  <header class="flex items-center justify-between">
    <h1 class="text-2xl">Allaparte</h1>
    <Button
      variant="filled"
      icon={Upload}
      disabled={importing}
      onclick={() => input.click()}
    >
      {importing ? "Importing…" : "Import scores"}
    </Button>
    <input
      bind:this={input}
      class="hidden"
      type="file"
      accept=".mxl,.musicxml,.xml,.mnx,.json"
      multiple
      onchange={chooseFiles}
    />
  </header>

  {#each reports.filter((r) => r.error || r.diagnostics.length) as report (report.file)}
    <Alert color={report.error ? "error" : "secondary"}>
      <details>
        <summary>
          {report.file}:
          {report.error ??
            `imported, with converter messages (${report.diagnostics.length})`}
        </summary>
        <ul class="list-disc pl-6 text-sm">
          {#each report.diagnostics as { severity, message }, index (index)}
            <li>{severity}: {message}</li>
          {/each}
        </ul>
      </details>
    </Alert>
  {/each}

  {#await library.loaded then}
    <ul class="flex flex-col gap-2">
      {#each library.pieces as piece (piece.id)}
        <li>
          <a
            class="block rounded-lg border p-3"
            href={resolve("/pieces/[id]", { id: piece.id })}
          >
            {piece.title}
            {#if piece.composer}
              <span class="text-sm opacity-70">{piece.composer}</span>
            {/if}
          </a>
        </li>
      {:else}
        <li>Import a MusicXML or MNX file to begin.</li>
      {/each}
    </ul>
  {/await}
</main>
