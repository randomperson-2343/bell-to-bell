# Bell to Bell · Code Graph

A map of the whole Bell to Bell codebase, built with **graphify** and extended so every connection has a label and a direction.

- **805 notes**, one per file, class, function, method, stylesheet, font and design idea
- **2591 labelled connections**
- **23 groups** of code that work closely together

## Start here

- [[Architecture - who uses whom.canvas|Architecture: who uses whom]]: every source file and the arrows between them, each arrow labelled with what is borrowed
- [[Architecture - page load order.canvas|Architecture: page load order]]: what `index.html` loads, step by step
- [[Design ideas - where they live in code.canvas|Design ideas: where they live in code]]: README and art direction ideas tied to the files that build them
- [[Graphify Report]]: graphify's own summary (most connected code, surprising links)
- Graph view: press `Ctrl/Cmd + G`

## Groups

- [[_COMMUNITY_Boot, Menus and Save Slots|Boot, Menus and Save Slots]] (103)
- [[_COMMUNITY_Trading Desk HUD and Order Ticket|Trading Desk HUD and Order Ticket]] (85)
- [[_COMMUNITY_Game Loop and Sound Effects|Game Loop and Sound Effects]] (79)
- [[_COMMUNITY_Storyboard and Decision Scenes|Storyboard and Decision Scenes]] (69)
- [[_COMMUNITY_Endless Mode and Market Feeds|Endless Mode and Market Feeds]] (62)
- [[_COMMUNITY_Cinematics and Stress|Cinematics and Stress]] (61)
- [[_COMMUNITY_Price Engine and Design Concepts|Price Engine and Design Concepts]] (44)
- [[_COMMUNITY_Pixel Art, Palette and Fonts|Pixel Art, Palette and Fonts]] (42)
- [[_COMMUNITY_Brokerage Account|Brokerage Account]] (41)
- [[_COMMUNITY_Story Briefings and Quotas|Story Briefings and Quotas]] (30)
- [[_COMMUNITY_Rhythm Storyboard Layer|Rhythm Storyboard Layer]] (26)
- [[_COMMUNITY_Render Regression Tests|Render Regression Tests]] (22)
- [[_COMMUNITY_Chiptune Music|Chiptune Music]] (19)
- [[_COMMUNITY_Phone Interruptions|Phone Interruptions]] (19)
- [[_COMMUNITY_Personal Economy|Personal Economy]] (17)
- [[_COMMUNITY_Ending Reachability Tests|Ending Reachability Tests]] (17)
- [[_COMMUNITY_Storyboard Export Tool|Storyboard Export Tool]] (15)
- [[_COMMUNITY_Headless Test Loader|Headless Test Loader]] (12)
- [[_COMMUNITY_Balance and Unit Test Runners|Balance and Unit Test Runners]] (11)
- [[_COMMUNITY_Life Beats and Payroll|Life Beats and Payroll]] (9)
- [[_COMMUNITY_Ending Resolution|Ending Resolution]] (8)
- [[_COMMUNITY_The Ledger Subscription|The Ledger Subscription]] (8)
- [[_COMMUNITY_Full-Game Bot Simulation|Full-Game Bot Simulation]] (6)

## How to read a note

Each note has two lists:

- **Points to**: connections leaving this piece of code, written like `calls → draw()`.
- **Pointed to by**: connections arriving, written with the reverse label, like `called by ← news()`.

Grey text after a link tells you *which* shared name was used (for example `BTB.Pixel.text`), the line number, and whether the link is inferred.

## What each label means

| Label | Reverse label | Meaning | Count |
|---|---|---|---|
| contains | defined in | the file or scope defines this symbol | 515 |
| has method | method of | the class defines this method | 125 |
| calls | called by | runs this function (same file: parsed; across files: through the BTB namespace) | 1136 |
| may call | may be called by | passes this function along as a callback or stores it in a list, so it probably runs later (inferred) | 66 |
| imports | imported by | Node require() of a named export | 12 |
| imports from | imported by | Node require() of a whole module | 21 |
| uses | used by | reads a value or object another file published on BTB | 213 |
| instantiates | instantiated by | creates an object with new | 22 |
| depends on | needed by | file-level summary: this file reads things the other file published on BTB | 258 |
| loads script | loaded by | the HTML page loads this script with a <script> tag, in order | 74 |
| loads stylesheet | stylesheet of | the HTML page loads this CSS file | 4 |
| reads tokens from | tokens read by | the CSS uses var(--...) colours/sizes defined in tokens.css | 2 |
| declares font | font declared in | the CSS registers this font face | 5 |
| creates | created by | this file creates the shared namespace object | 1 |
| publishes to | receives exports from | this file hangs its exports on the shared BTB namespace | 42 |
| describes | described in | the design doc explains this idea | 29 |
| implemented in | implements | this idea from the docs is built in that code | 63 |
| related to | related to | the docs tie these two ideas together | 3 |

## Seeing labels on the graph lines

Obsidian's built-in graph view draws lines but never prints labels on them. The labels are always in each note and on the canvases. To also see them on the graph view:

1. Settings → Community plugins → turn on community plugins.
2. Browse → install and enable **Dataview**.
3. Browse → install and enable **Graph Link Types**.
4. Open the graph view. Each line now shows its label (calls, uses, depends on, …).

## Why "BTB"?

The game has no imports between files. `js/core/util.js` creates one shared object, `window.BTB`, and every other file puts its parts on it (`BTB.Market`, `BTB.Broker`, …) and reads other files' parts back off it. graphify's automatic pass cannot see those links, so they were added by scanning every `BTB.` reference and tracing it to where it was defined. They are marked as extracted from the source, not guessed.

## What is in the graph

| Kind | Count |
|---|---|
| function | 515 |
| method | 125 |
| file | 51 |
| value | 51 |
| concept | 29 |
| class or object | 13 |
| external module | 7 |
| font | 5 |
| stylesheet | 4 |
| page | 2 |
| document | 2 |
| namespace | 1 |

## Known gaps

- Calls made through an object stored in a variable (for example `game.js` running `this.market.step()`) are not traced, because the code never names `BTB.Market` at that spot. The file-level link (`game.js` depends on `engine.js`) is still there.
- Fonts (`.woff2`) and screenshots are not parsed. The CSS files are included as notes, with their links to fonts and palette tokens.
- Design idea links marked "inferred" are judgement calls from reading the README and art direction doc against the code. Everything else is read straight from the source.
