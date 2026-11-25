# Bell to Bell art sources

Hand-drawn pixel art, edited in [Aseprite](https://www.aseprite.org/). Everything stays inside the locked 32-colour Faded Power palette (`art/palette/faded-power.gpl`, the same colours as `js/art/palette.js` and `css/tokens.css`). See `ART_DIRECTION.md` for the look.

| Folder | What it holds |
| --- | --- |
| `art/src/` | The `.aseprite` source files. Indexed colour: index 0 is transparent, 1 to 32 are the palette. Frames are tagged (a portrait has `open` and `closed`, the blink). |
| `art/export/` | What Aseprite exports from them: a PNG strip of frames and a JSON beside it. |
| `art/palette/` | The palette as a GIMP `.gpl` file, loadable in Aseprite. |

The game itself draws from `js/art/sprite-data.js`, generated from `art/export/`. It is a script rather than PNGs because the game opens straight from `index.html` with no server, and a canvas that draws a PNG from a `file://` page cannot be read back in most browsers. Where a picture has no drawing yet, the old code-drawn version is used.

## Editing a picture

1. Open the `.aseprite` file in `art/src/`, draw, save. Keep the palette and the frame tags.
2. Re-export everything and rebuild the game's data:

   ```
   ASEPRITE=/path/to/aseprite node tools/art/pack.js --export-all
   ```

3. Run the tests (`node js/tests/node-run.js`).

`node tools/art/build-sprites.js --check` fails when `sprite-data.js` is out of date with `art/export/`.

## Drawing from text

The art team works in `.grid` text files (one palette key per pixel, `@frame <name>` between frames). `tools/art/grid.js` checks and previews them; `tools/art/pack.js <file.grid> <group>/<name>` turns one into an `.aseprite`, exports it and rebuilds the data.
