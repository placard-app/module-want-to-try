# Want to Try

Keep a personal checklist on each place. Add an item, mark it tried, or delete it. Lists are private to the signed-in user and place, including on shared places. The module checks place access on every request and stores data in its persistent module directory.

## Install

Build with Node 24 or newer and pnpm using `pnpm install` and `pnpm build`. Upload the `.placard-module` file in `dist` through Placard's module marketplace. The host must support SDK 0.2.0, place sections, and persistent data.

Run `pnpm test` and `pnpm typecheck` to verify changes. The module stores its SQLite database in the host-provided module data directory. Back up that directory with the rest of Placard's data.
