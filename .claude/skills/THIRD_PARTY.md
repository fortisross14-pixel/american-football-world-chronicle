# Third-party skills

## Installed as plugins

`.claude/settings.json` registers the
[awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills)
marketplace (Apache-2.0) and enables its `router`, `disciplines` (game-feel, game-ui-ux,
save-systems, performance-optimization, procedural-gen, audio-design, …), `web-engines`
and `workflows` plugins. Claude Code asks you to trust and install them the first time
you open the project.

## Adapted into this folder

| Skill | Source | License | Changes |
|---|---|---|---|
| `balance-check` | [Donchitos/Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios) `.claude/skills/balance-check` | MIT | Rewritten for this repo: removed studio config hooks, GDD/registry and director-gate dependencies; targets and commands are this game's |
| `soak-test` | same, `.claude/skills/soak-test` | MIT | Rewritten as a headless multi-season soak for this sim |
| `patch-notes` | same, `.claude/skills/patch-notes` | MIT | Rewritten: removed studio config hooks and production/ paths |

Project-specific skills written for this repo: `game-design-audit`,
`sim-narrative-design`, `game-feel-and-juice`.

Apache-2.0 text: https://www.apache.org/licenses/LICENSE-2.0
MIT notice for Claude-Code-Game-Studios: Copyright (c) 2026 Donchitos. Permission is
hereby granted, free of charge, to any person obtaining a copy of this software and
associated documentation files, to deal in the Software without restriction, subject
to including this notice. The software is provided "as is", without warranty of any kind.
