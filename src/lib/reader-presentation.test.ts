import { expect, test } from "vitest";
import { toReaderPresentation } from "./reader-presentation.js";

test("strips the arranger's page layout and engraving choices, keeping the music", () => {
  const pitch = { octave: 4, step: "C" };
  const source = {
    scores: [
      {
        name: "Violin",
        layout: "violin",
        pages: [{ systems: [] }],
        _x: { viritura: { pageSetup: {}, layoutBreaks: [], other: 1 } },
      },
    ],
    parts: [
      {
        id: "violin",
        measures: [
          {
            beams: [{ events: ["e1"] }],
            sequences: [
              {
                stem: "up",
                content: [
                  {
                    type: "tuplet",
                    content: [
                      {
                        id: "e1",
                        stemDirection: "down",
                        notes: [
                          { pitch, ties: [{ target: "n2", side: "up" }] },
                        ],
                        slurs: [{ target: "e2", side: "up", sideEnd: "down" }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  const before = structuredClone(source);

  expect(toReaderPresentation(source)).toEqual({
    scores: [
      { name: "Violin", layout: "violin", _x: { viritura: { other: 1 } } },
    ],
    parts: [
      {
        id: "violin",
        measures: [
          {
            sequences: [
              {
                content: [
                  {
                    type: "tuplet",
                    content: [
                      {
                        id: "e1",
                        notes: [{ pitch, ties: [{ target: "n2" }] }],
                        slurs: [{ target: "e2" }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
  expect(source).toEqual(before);
});
