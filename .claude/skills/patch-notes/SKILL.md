---
name: patch-notes
description: "Write player-facing patch notes for this game from git history — what changed, in player language, with before → after numbers for balance changes. Use when releasing a version, pushing to main/GitHub Pages, or when asked for a changelog, release notes or 'what's new'."
argument-hint: "[version] [brief|detailed]"
---

# Patch notes

Adapted from the `patch-notes` skill in
[Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios) (MIT).

## 1. Gather

- `git log --oneline <last-release>..HEAD` and the diffs of the commits it lists.
  The version shown in the app lives in `src/App.jsx` (launcher badge) and
  `ensureUniverse` (`u.version`).
- Only describe changes you can see in the diff. If a commit message claims
  something the diff does not show, leave it out.

## 2. Categorise and translate

| Category | Examples here |
|---|---|
| **New** | new screens, reveals, headline types, systems |
| **Changes** | balance (re-sign odds, award fatigue, dynasty limits) with before → after |
| **Quality of life** | shortcuts, mobile layout, navigation |
| **Fixes** | grammar, layout bugs, sim bugs — described as the player saw them |
| **Known issues** | anything shipped with a caveat |

Translate: "refactored `marqueeFreeAgency` scoring" → "Free agents now weigh
contenders and playing time when choosing a team". Keep numbers for balance:
"Legend re-sign chance 90% → 74%".

Drop purely internal changes (QA scripts, skills, refactors) unless players feel them.

## 3. Format (brief)

```markdown
# vX.Y — [Title]

**New**
- ...

**Changes**
- ... (before → after)

**Quality of life**
- ...

**Fixes**
- ...
```

Lead with the one or two changes players will be most excited about. Write
like a sports-league announcement, not a commit log: short, concrete, a little
hype, no jargon. Save to `CHANGELOG.md` at the repo root (newest version first)
unless told otherwise.
