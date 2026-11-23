import JSZip from "jszip";
import { expect, test } from "vitest";
import { importScore } from "./import-score.js";
import { readMetadata } from "./metadata.js";

const MUSICXML = `<score-partwise version="4.0">
  <work><work-title>Milonga</work-title></work>
  <identification><creator type="composer">A. Composer</creator></identification>
  <part-list><score-part id="P1"><part-name>Violin</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>`;

async function mxl() {
  const zip = new JSZip();
  zip.file("score.xml", MUSICXML);
  return zip.generateAsync({ type: "arraybuffer" });
}

test.each([
  ["musicxml", async () => MUSICXML],
  ["mxl", mxl],
])("imports .%s with its title and credits", async (extension, contents) => {
  const file = new File([await contents()], `milonga.${extension}`);

  const { mnx } = await importScore(file);

  expect(readMetadata(mnx)).toMatchObject({
    title: "Milonga",
    composer: "A. Composer",
  });
  expect(mnx.parts).toHaveLength(1);
});

test("imports .mnx as is", async () => {
  const mnx = { mnx: { version: 1 }, parts: [] };
  const file = new File([JSON.stringify(mnx)], "piece.MNX");

  expect((await importScore(file)).mnx).toEqual(mnx);
});

test("rejects other files", async () => {
  await expect(importScore(new File([""], "piece.pdf"))).rejects.toThrow();
});
