import { readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseMnx } from "../../vendor/viritura/packages/format/src/index";
import { convertScoreToMusicXml } from "../../vendor/viritura/packages/musicxml/src/index";

// MuseScore can't read these. Viritura only keeps its own data in them.
const OTHER_NOTATIONS = /<other-notation.*?<\/other-notation>/gs;

const [output, ...files] = process.argv.slice(2);
for (const file of files) {
  const name = basename(file, ".mnx");
  try {
    const score = parseMnx(JSON.parse(readFileSync(file, "utf8")));
    const { xml } = convertScoreToMusicXml(score);
    const readable = xml.replace(OTHER_NOTATIONS, "");
    writeFileSync(join(output, `${name}.musicxml`), readable);
  } catch (error) {
    console.warn(`Can't convert ${file} to MusicXML: ${error}`);
  }
}
