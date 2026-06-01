# Design Notes

The template is optimized for a creator using Obsidian as an active writing and research cockpit.

Core decisions:

- Chinese folder names first, because recognition speed matters more than technical purity.
- One homepage plus category navigation, so the left file tree is not the only way to browse.
- AI actions are explicit buttons, not hidden automation.
- Output actions are safe by default and write new files.
- Modify actions always back up the current note before replacement.
- Hermes model selection stays local and reads runtime configuration without publishing it.

