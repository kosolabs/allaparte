# Spike: revised MuseScore charts

> **Date:** 2026-11-19. **Question:** When a chart is revised in MuseScore and
> exported again, can Allaparte tell what changed, and keep bar identity for
> annotations and edits? Files: "MuseScore test exports" in the [Allaparte Drive folder](https://drive.google.com/drive/folders/1W2D1fX-WCzxiiJ9AjRpBdcPEmCwkJN7_).

## Method

One real chart ("Mil Pasos": clarinet, voice, guitar, piano, contrabass; 160
bars), exported from MuseScore Studio 4.7.7 three times, each as MusicXML
(`.mxl`) and with MuseScore's experimental MNX export:

- **Original.**
- **Again:** exported again with no changes.
- **Next:** after adding notes to an empty bar.
- **Structural:** after inserting two bars before rehearsal mark A, deleting
  the second bar after B, and changing pitches and rhythms in the first two
  bars of C. It turned out to be made from the original rather than from
  "Next" (it lacks Next's added notes), which doesn't affect the comparison.

The MusicXML was converted with Viritura's converter at commit 90a417c (with
`includeVendorExtensions: true`), and both routes were rendered with the
engine from the same commit.

## Results

**Exports are deterministic.** "Again" is byte-for-byte identical to the
original in both formats, so any difference between exports is a real
change.

**MuseScore's MNX carries stable IDs.** Every bar, part and event has an ID
(5,388 in all). Between the original and "Next", all 160 bar IDs, all part
IDs and all 2,667 existing event IDs are unchanged, in the same places, with
unchanged content. The revision shows up exactly: 4 new events (notes with
the lyrics "Un pa-so me") in Clarinet bar 9. The MusicXML diff of the same
change is 649 lines, mostly page positions that shifted.

**Bar and note IDs survive structural edits.** Compared with "Next",
"Structural" has:

- 2 new bar IDs, exactly where the bars were inserted;
- 1 bar ID gone, the deleted bar, along with its events in every part;
- the other 159 bar IDs unchanged and in the same order, so rehearsal marks
  and everything else simply shifted (A from bar 9 to 11, C from 49 to 50);
- no surviving event moved to a different bar;
- the changed pitches and rhythms at C keeping their event IDs, with new
  content. One event there disappeared, where a rhythm change merged notes.

So "same ID" means "same bar" or "same note", not "unchanged": telling
whether a note changed means comparing its content.

**Part IDs are not stable.** All five parts had new IDs in "Structural",
with identical names and order. The other exports were likely made in one
MuseScore session and "Structural" in a later one; MuseScore seems to keep
bar and note IDs in the file but regenerate part IDs. Parts have to be
matched by name and position.

**The converter's IDs are new on every conversion.** The original and "Next"
converted from MusicXML share no bar IDs.

**MuseScore's MNX export is incomplete; the MusicXML route is not.**

| Content | MuseScore MNX | MusicXML via converter |
| --- | --- | --- |
| Title and composer | Missing | Present |
| Chord symbols | Missing (0) | Present (160) |
| Dynamics | Missing (0) | Present (12) |
| Beams | Missing (0) | Present (60) |
| Whole-bar rests | Missing (empty bars render blank) | Present |
| Lyrics, ties, slurs | 497, 161, 15 | 497, 161, 15 |
| Part definitions (`scores[]`) | Missing | Full score plus each part |

Rendered with Viritura's engine, MuseScore's MNX also repeats the tempo above
every staff. The converter has its own small issues: a doubled "Clarinet in
Bb in B♭" label, and a layout that moves the piano above the voice.

**The two exports line up note for note.** In every part-bar (800 for the
original, 805 for "Structural"), the sounding notes in MuseScore's MNX and in
the converted MusicXML match exactly, in order.

## What this suggests

Import both files from each export: **content from the MusicXML, IDs from
the MNX.** Bar IDs copy across by position, and note events copy across in
order within each part and bar. Rests that MuseScore's MNX omits keep
converter-made IDs.

A piece then carries MuseScore's bar and note IDs. When a revised chart is
imported, the same IDs identify the same bars and notes, so:

- annotations, anchored to bar IDs, stay on their bars through inserted and
  deleted bars; only annotations on a deleted bar lose their anchor;
- the change between versions is exact, not guessed;
- an Allaparte edit to a note can be re-applied when that note's content is
  unchanged in the revision, and flagged when it changed or was deleted.

If MuseScore's MNX export becomes complete, the MusicXML file stops being
needed.

## Not yet tested

- **MuseScore's IDs in Viritura's editor.** They are base64-like strings, not
  the UUID v7 IDs Viritura generates. The engine renders them; the editor's
  editing paths are untested with them.
- **More than one chart.** Note-for-note alignment held for this chart; other
  charts (tuplets, grace notes, multiple voices) may not line up as cleanly.
