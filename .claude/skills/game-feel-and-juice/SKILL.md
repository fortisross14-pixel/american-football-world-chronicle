---
name: game-feel-and-juice
description: Add game feel ("juice") to this web game's UI — reveals, pacing, anticipation, motion and emphasis for big moments — without hurting performance or mobile play. Use when building reveal cards, celebrations, finale screens, draft night, or anything meant to feel exciting rather than informational.
---

# Game feel & juice (web, sim game)

Juice is feedback that makes an outcome *feel* like it matters. In a sim game
the player's input is a tap on "next", so all the feel lives in how the answer
arrives.

## The reveal pattern

Break a big outcome into beats the player taps through:

1. **Tease** — face-down card, a label ("SIGNS WITH"), a badge with stakes
   ("CHASING A RING", "NO. 1 OVERALL").
2. **Context** — the known part first (origin team, the player).
3. **Answer** — the unknown last (destination, true talent), with the biggest
   motion and colour shift.
4. **Settle** — a compact recap row of everything revealed so far.

Always offer **Reveal all** and **Restart**: never trap a player in ceremony.
Reference: `RevealDeck` in `src/components/Legacy.jsx`.

## Motion rules

- 3D flip: `perspective` on the slot, `transform-style: preserve-3d`,
  `backface-visibility: hidden` on both faces. Stack faces with
  `display:grid; grid-area:1/1` (not absolute) so cards size to content.
- 400–700ms for a reveal, ease-out (`cubic-bezier(.2,.8,.2,1)`); 150–250ms for
  hovers and taps. Nothing loops forever.
- Animate `transform` and `opacity` only. Colour shifts via a CSS variable
  (`--rv`) with a `background` transition are fine.
- Respect `@media (prefers-reduced-motion: reduce)` — remove the transition,
  keep the reveal.

## Emphasis hierarchy

- One focal element per screen. Gold (`#f3c94d`) is reserved for titles,
  dynasties and true-talent reveals; don't spend it on ordinary rows.
- Rarity colours (`--common` … `--generational`) carry meaning — use
  `RarityPill`, never ad-hoc colours for rarity.
- Team colours tint backgrounds via `color-mix(in srgb, var(--team) 30%, #08131f)`.
  Dark team primaries vanish on dark UI: mix with a light colour for bars and
  lines (`color-mix(in srgb, var(--c) 65%, #cfe3f5)`).

## Mobile

- Test at 390×844. Multi-slot reveals stack vertically under 700px with a
  rotated arrow between beats.
- Primary action is the big red `.advance` button; keep it in the same place
  between beats so the player can tap without looking.
- Counters and labels use `white-space: nowrap`.

## Don't

- Don't auto-advance timers the player can't control.
- Don't add sound or confetti libraries; CSS is enough here and keeps the
  bundle small.
- Don't hide information the player needs to make sense of the moment — the
  table view stays one tap away.
