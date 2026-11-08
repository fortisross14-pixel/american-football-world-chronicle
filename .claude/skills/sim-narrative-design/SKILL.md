---
name: sim-narrative-design
description: Write emergent storytelling for this sports simulation — headlines, storylines, rivalries, dynasties, milestones and season arcs generated from sim data. Use when adding or editing news, stories, awards text, offseason narratives or anything in src/sim/stories.js, chronicle.js or legacy.js.
---

# Sim narrative design

The simulation already produces drama. The narrative layer's job is to
**notice it, frame it and remember it**. Never invent outcomes to tell a story;
find the story in the outcomes.

## Principles

1. **Setup → payoff.** Every strong story has a question posed before the
   result. Pair them: preseason favourite ↔ bust/surprise; contract year ↔
   free-agency decision; ring chaser ↔ "finally gets his ring"; three-peat
   chase ↔ dynasty ceiling. If you add a payoff, add its setup (and vice versa).
2. **Scarcity of superlatives.** Importance scores (`addNews` 0–100) must
   reflect rarity. Reserve 95+ for once-a-decade events. If a headline type
   fires every week, it is texture, not news — lower it or gate it.
3. **History is context.** Prefer "first title in 14 years", "third straight",
   "again" over bare results. Use `titleContext`, `seasonHistory`,
   rivalries and records before writing a generic line.
4. **Name the people.** A headline about a team should name the player or
   coach who made it happen when the data allows.
5. **One fact per headline, one reason in the body.** Title says what; body
   says why it matters (numbers, history, stakes).

## Mechanics in this codebase

- `addNews(u, TYPE, importance, title, body, teamId, playerId)` in
  `src/sim/season.js`. TYPE is uppercase and shown as a chip; add new types to
  `STORY_GROUPS` in `src/sim/stories.js` if they need grouping.
- `src/sim/legacy.js`: `titleContext`, `titleHeadline`, `dynastyEras`,
  `titleCapReason`, preseason outlook. Pure helpers — pass callbacks rather than
  importing season.js (avoids a circular import).
- Hard dynasty ceiling: at most 3 straight titles, 4 in 6 years, 5 in 10.
  Stories may hint at the ceiling ("history says it holds") but must never
  break it.

## Grammar helpers

- Team names ending in "s" are plural: use `verb(name,'win','wins')` and
  `isPlural(name)` for possessives (`Steelers’` vs `Ohio State’s`).
- Articles before grades: "an A+", "an F", "a B".
- Numbers: `toFixed(1)` for odds and money; integers for yards and counts.

## Arc checklist per season

- [ ] Preseason: favourites + odds, defending champ question, contract years
- [ ] Midseason: MVP race, record chases, deadline deals, rivalries heating up
- [ ] Postseason: upsets, dethroned champion, denied dynasty
- [ ] Finale: title with history, long shot / surprise / bust verdicts
- [ ] Offseason: who left the champion, marquee signings with suitors,
      top picks with true talent, report cards

Test with a 10–15 season headless run and read the headlines in order. If two
seasons read the same, a story is missing.
