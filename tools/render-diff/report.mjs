import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TARGET } from "./environment.mjs";

const REPORTS = join(TARGET, "reports");
const FILES = "files";
const CROP_MARGIN = 8;
const MOST_OPEN_SECTIONS = 20;

export function writeReport(name, title, renderings) {
  mkdirSync(join(REPORTS, FILES), { recursive: true });
  const html = join(REPORTS, `${name}.html`);
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
  img.verovio { width: auto; }
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

function htmlSection({ name, mnx, images, others = [] }, open) {
  return `<details${open ? " open" : ""}>
<summary>${escape(name)}</summary>
<template>
MNX<iframe loading="lazy" src="${publishMnx(mnx)}"></iframe>
${images.map(htmlImage).join("\n")}
${others.map(htmlOther).join("\n")}
</template>
</details>`;
}

function htmlImage({ label, svg }) {
  return svg
    ? `${label}<img loading="lazy" src="${publishSvg(svg)}">`
    : `<p>${label}: not drawn</p>`;
}

function htmlOther({ name, pages }) {
  if (pages.length === 0) return `<p>${name}: not drawn</p>`;
  const id = name.toLowerCase();
  const images = pages.map(
    (svg) => `<img class="${id}" loading="lazy" src="${publishAsIs(svg)}">`,
  );
  return `${name}${images.join("\n")}`;
}

const publishSvg = once((file) => publish(file, ".svg", crop));
const publishAsIs = once((file) => publish(file, ".svg", (svg) => svg));
const publishMnx = once((file) =>
  publish(file, ".mnx.txt", (mnx) => formatJson(JSON.parse(mnx))),
);

function once(publisher) {
  const published = new Map();
  return (file) => {
    if (!published.has(file)) published.set(file, publisher(file));
    return published.get(file);
  };
}

// Named by content, so that reports share what they have in common.
function publish(file, extension, transform) {
  const content = transform(readFileSync(file, "utf8"));
  const hash = createHash("sha256").update(content).digest("hex");
  const name = `${FILES}/${hash.slice(0, 16)}${extension}`;
  const path = join(REPORTS, name);
  if (!existsSync(path)) writeFileSync(path, content);
  return name;
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
