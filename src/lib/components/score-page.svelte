<script lang="ts">
  import type {
    DisplayList,
    Engine,
    PageGeometry,
  } from "@viritura/score-engine";

  interface Props {
    engine: Engine;
    layout: DisplayList;
    page: PageGeometry;
  }

  const { engine, layout, page }: Props = $props();

  let near = $state(false);

  // Safari caps total canvas memory, so only pages near the screen get one.
  function watch(element: HTMLElement) {
    const observer = new IntersectionObserver(
      ([entry]) => (near = entry.isIntersecting),
      { rootMargin: "100%" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }

  function draw(canvas: HTMLCanvasElement) {
    const scale = devicePixelRatio;
    canvas.width = page.width * scale;
    canvas.height = page.height * scale;
    const context = canvas.getContext("2d")!;
    context.scale(scale, scale);
    engine.paint(context, layout, { page: page.index, background: "#fff" });
  }
</script>

<div
  class="bg-white"
  style:width="{page.width}px"
  style:height="{page.height}px"
  {@attach watch}
>
  {#if near}
    <canvas class="size-full" {@attach draw}></canvas>
  {/if}
</div>
