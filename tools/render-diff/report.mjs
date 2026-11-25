import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import { TARGET } from "./environment.mjs";

const REPORT = join(TARGET, "report");
const FILES = "files";
const CROP_MARGIN = 8;
const MOST_OPEN_SECTIONS = 20;

export function writeReport(title, renderings) {
  rmSync(REPORT, { recursive: true, force: true });
  mkdirSync(join(REPORT, FILES), { recursive: true });
  writeFileSync(join(REPORT, "report.md"), markdown(renderings));
  const html = join(REPORT, "index.html");
  writeFileSync(html, htmlPage(title, renderings));
  return html;
}

function htmlPage(title, renderings) {
  const open = renderings.length <= MOST_OPEN_SECTIONS;
  return `<!doctype html>
<meta charset="utf-8">
<title>${escape(title)}</title>
<style>
  body { font: 15px system-ui; margin: 2rem auto; max-width: 1100px; padding: 0 1rem; }
  summary { cursor: pointer; font-family: ui-monospace, monospace; padding: 0.4rem 0; word-break: break-all; }
  iframe { border: 1px solid #ccc; height: 14rem; resize: vertical; width: 100%; }
  img { border: 1px solid #ccc; display: block; margin: 0.25rem 0 1rem; max-width: 100%; width: 100%; }
  img.musescore { width: auto; zoom: 3; }
</style>
<h1>${escape(title)}</h1>
<p>Drawings: ${renderings.length}</p>
${renderings.map((rendering) => htmlSection(rendering, open)).join("\n")}
<script>
  for (const section of document.querySelectorAll("details")) {
    const template = section.querySelector("template");
    const load = () => template.replaceWith(template.content);
    if (section.open) load();
    else section.addEventListener("toggle", load, { once: true });
  }
</script>
`;
}

function htmlSection({ name, mnx, images, museScore }, open) {
  return `<details${open ? " open" : ""}>
<summary>${escape(name)}</summary>
<template>
MNX<iframe loading="lazy" src="${publishMnx(mnx)}"></iframe>
${images.map(htmlImage).join("\n")}
${museScore ? htmlMuseScore(museScore) : ""}
</template>
</details>`;
}

function htmlImage({ label, svg }) {
  return svg
    ? `${label}<img loading="lazy" src="${publishSvg(svg)}">`
    : `<p>${label}: not drawn</p>`;
}

function htmlMuseScore(pages) {
  if (pages.length === 0) return "<p>MuseScore couldn't draw this</p>";
  const images = pages.map(
    (svg) => `<img class="musescore" loading="lazy" src="${publishAsIs(svg)}">`,
  );
  return `MuseScore${images.join("\n")}`;
}

function markdown(renderings) {
  return renderings.map(markdownSection).join("\n");
}

function markdownSection({ name, mnx, images, museScore }) {
  return `### \`${name}\`

<details>
<summary>MNX</summary>

\`\`\`json
${readFileSync(join(REPORT, publishMnx(mnx)), "utf8")}
\`\`\`

</details>

${images.map(markdownImage).join("\n")}
${museScore ? markdownMuseScore(museScore) : ""}`;
}

function markdownImage({ label, svg }) {
  return svg
    ? `${label}:\n\n![${label}](${publishSvg(svg)})\n`
    : `${label}: not drawn\n`;
}

function markdownMuseScore(pages) {
  if (pages.length === 0) return "MuseScore couldn't draw this\n";
  const images = pages.map((svg) => `![MuseScore](${publishAsIs(svg)})\n`);
  return `MuseScore:\n\n${images.join("\n")}`;
}

function publishSvg(file) {
  return publish(file, basename(file), crop);
}

function publishMnx(file) {
  const format = (mnx) => formatJson(JSON.parse(mnx));
  return publish(file, `${basename(file)}.txt`, format);
}

function publishAsIs(file) {
  return publish(file, `musescore-${basename(file)}`, (svg) => svg);
}

function publish(file, name, transform) {
  const path = join(REPORT, FILES, name);
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
