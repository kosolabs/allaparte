import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const FILES = "files";
const CROP_MARGIN = 8;

export function writeHtml(directory, title, renderings) {
  const changed = renderings.filter((rendering) => rendering.changed);
  const unchanged = renderings.filter((rendering) => !rendering.changed);
  const sections = (list) =>
    list.map((rendering) => htmlSection(directory, rendering)).join("\n");
  const html = `<!doctype html>
<meta charset="utf-8">
<title>${escape(title)}</title>
<style>
  body { font: 15px system-ui; margin: 2rem auto; max-width: 1100px; padding: 0 1rem; }
  summary { cursor: pointer; font-family: ui-monospace, monospace; padding: 0.4rem 0; word-break: break-all; }
  iframe { border: 1px solid #ccc; height: 14rem; resize: vertical; width: 100%; }
  img { border: 1px solid #ccc; display: block; margin: 0.25rem 0 1rem; max-width: 100%; width: 100%; }
</style>
<h1>${escape(title)}</h1>
<h2>Changed (${changed.length})</h2>
${sections(changed)}
<h2>Unchanged (${unchanged.length})</h2>
${sections(unchanged)}
<script>
  for (const section of document.querySelectorAll("details")) {
    const template = section.querySelector("template");
    const load = () => template.replaceWith(template.content);
    if (section.open) load();
    else section.addEventListener("toggle", load, { once: true });
  }
</script>
`;
  writeFileSync(join(directory, "index.html"), html);
}

function htmlSection(directory, { name, mnx, changed, pages }) {
  const image = (label, svg) =>
    svg
      ? `${label}<img loading="lazy" src="${publishSvg(directory, svg)}">`
      : `<p>${label}: not drawn</p>`;
  const shown = pages.filter((page) => page.changed === changed);
  const images = shown.map(({ number, before, after }) => {
    const page = pages.length > 1 ? ` (page ${number})` : "";
    return changed
      ? image(`Before${page}`, before) + image(`After${page}`, after)
      : image(`Before and after${page}`, after);
  });
  return `<details${changed ? " open" : ""}>
<summary>${escape(name)}</summary>
<template>
MNX<iframe loading="lazy" src="${publishMnx(directory, mnx)}"></iframe>
${images.join("\n")}
</template>
</details>`;
}

export function writeMarkdown(directory, renderings) {
  const sections = renderings
    .filter((rendering) => rendering.changed)
    .map((rendering) => markdownSection(directory, rendering));
  writeFileSync(join(directory, "changes.md"), sections.join("\n"));
}

function markdownSection(directory, { name, mnx, pages }) {
  const image = (label, svg) =>
    svg
      ? `${label}:\n\n![${label}](${publishSvg(directory, svg)})\n`
      : `${label}: not drawn\n`;
  const images = pages
    .filter((page) => page.changed)
    .flatMap(({ number, before, after }) => {
      const page = pages.length > 1 ? ` (page ${number})` : "";
      return [image(`Before${page}`, before), image(`After${page}`, after)];
    });
  return `### \`${name}\`

<details>
<summary>MNX</summary>

\`\`\`json
${readFileSync(join(directory, publishMnx(directory, mnx)), "utf8")}
\`\`\`

</details>

${images.join("\n")}`;
}

function publishSvg(directory, file) {
  return publish(directory, file, basename(file), crop);
}

function publishMnx(directory, file) {
  const format = (mnx) => formatJson(JSON.parse(mnx));
  return publish(directory, file, `${basename(file)}.txt`, format);
}

function publish(directory, file, name, transform) {
  mkdirSync(join(directory, FILES), { recursive: true });
  const path = join(directory, FILES, name);
  if (!existsSync(path)) {
    writeFileSync(path, transform(readFileSync(file, "utf8")));
  }
  return `${FILES}/${name}`;
}

function crop(svg) {
  const drawing = svg.slice(svg.indexOf(">"));
  const ys = [
    ...drawing.matchAll(/[MLCQ "]-?[\d.]+[ ,](-?[\d.]+)(?=[ MLCQZ"])/g),
    ...drawing.matchAll(/ c?y[12]?="(-?[\d.]+)"/g),
  ].map(([, y]) => Number(y));
  const top = ys.reduce((a, b) => Math.min(a, b), Infinity) - CROP_MARGIN;
  const bottom = ys.reduce((a, b) => Math.max(a, b), -Infinity) + CROP_MARGIN;
  if (!Number.isFinite(top)) return svg;
  return svg.replace(
    /width="([\d.]+)mm" height="[\d.]+mm" viewBox="[^"]*"/,
    (_, width) =>
      `width="${width}mm" height="${bottom - top}mm" viewBox="0 ${top} ${width} ${bottom - top}"`,
  );
}

function formatJson(value, indent = "") {
  const flat = JSON.stringify(value);
  if (flat.length + indent.length <= 100 || typeof value !== "object") {
    return flat;
  }
  const inner = `${indent}  `;
  const [open, close] = Array.isArray(value) ? "[]" : "{}";
  const items = Object.entries(value).map(([key, item]) => {
    const prefix = Array.isArray(value) ? "" : `${JSON.stringify(key)}: `;
    return `${inner}${prefix}${formatJson(item, inner)}`;
  });
  return `${open}\n${items.join(",\n")}\n${indent}${close}`;
}

function escape(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
}
