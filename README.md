# LegeRok

LegeRok is a local-first desktop data tracker for organizing information into boards. The current version is an early vertical slice: it initializes a local SQLite database, creates boards, lists them, and deletes boards with their associated data.

The application is built with Tauri 2, React 19, TypeScript, Vite, and Rust. Data stays in the local application database rather than being sent to a hosted service.

## Current Status

Implemented:

- Create a named board.
- Load boards ordered by position and creation time.
- Delete a board after confirmation.
- Persist boards, fields, and records in SQLite through the Tauri SQL plugin.
- Run as a desktop application through Tauri.

Not yet implemented:

- Opening a board and managing its fields or records.
- Editing board names or descriptions.
- Reordering boards.
- Search, filtering, import/export, synchronization, authentication, or a web deployment.
- Automated tests and CI configuration.

The `Field` and `Record` types and their database tables establish the foundation for later board functionality, but they do not currently have UI or service operations.

## Requirements

- Node.js 20 or newer with npm.
- Rust and Cargo with the platform prerequisites required by [Tauri 2](https://v2.tauri.app/start/prerequisites/).
- On Windows, the Microsoft C++ Build Tools and WebView2 runtime required by Tauri.

## Development

Install JavaScript dependencies:

```bash
npm install
```

Start the Vite frontend:

```bash
npm run dev
```

Run the full desktop application with Tauri:

```bash
npm run tauri dev
```

The Tauri development configuration expects the frontend at `http://localhost:1420`.

## Build

Check the TypeScript project and produce the frontend bundle:

```bash
npm run build
```

Build the desktop application and its installers for the configured Tauri targets:

```bash
npm run tauri build
```

Preview the frontend bundle without the Tauri shell:

```bash
npm run preview
```

The current build is strict about unused TypeScript values. The repository currently has an existing TypeScript error for the unused `isRefreshing` state in `src/components/boards/BoardList.tsx`; remove that state or render a refresh state before expecting `npm run build` to pass.

## Project Structure

```text
src/
	components/boards/  Board list and board creation UI
	components/ui/      Reusable Base UI and Tailwind components
	lib/                SQLite connection and board operations
	types/              Board, field, record, and field-type definitions
	App.tsx             Application root
	main.tsx            React entry point
src-tauri/
	src/lib.rs          SQLite migration and Tauri plugin setup
	src/main.rs         Native application entry point
	capabilities/       Tauri window permissions
	tauri.conf.json     Desktop build and window configuration
```

## Data Storage

The app opens `sqlite:legerok.db` using `@tauri-apps/plugin-sql`. The first migration creates:

- `boards`: names, descriptions, timestamps, and ordering positions.
- `fields`: board-specific field definitions, types, options, required flags, and positions.
- `records`: JSON data associated with a board.
- Indexes on `fields.board_id` and `records.board_id`.

Deleting a board is intended to remove its related fields and records through the declared foreign-key cascade. The database is local to the Tauri application profile and is not checked into this repository.

## Technology

- [Tauri 2](https://v2.tauri.app/) for the desktop runtime and packaging.
- [React](https://react.dev/) and [TypeScript](https://www.typescriptlang.org/) for the interface.
- [Vite](https://vite.dev/) for development and frontend builds.
- [SQLite](https://www.sqlite.org/) through `@tauri-apps/plugin-sql` for local persistence.
- [Tailwind CSS](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/), Base UI, and [Lucide](https://lucide.dev/) for UI foundations.
- [uuid](https://github.com/uuidjs/uuid) for board identifiers.

## Repository Conventions

- Use the `@/` alias for imports from `src`.
- Keep database operations in `src/lib` rather than directly in components.
- Keep shared domain shapes in `src/types`.
- Add schema changes as versioned Tauri SQL migrations in `src-tauri/src/lib.rs`.
- Run `npm run build` before submitting frontend changes.

## License

LegeRok is available under the [Prosperity Public License 3.0.0](LICENSE).

This is a source-available, noncommercial license, not an OSI-approved open-source license. Personal, educational, research, hobby, and other qualifying noncommercial use is permitted. Commercial use is limited to a 30-day trial per company; continued commercial use requires a separate commercial license from the contributor. See the complete [LICENSE](LICENSE) for the controlling terms.

Third-party dependencies remain under their own licenses. This repository's license does not replace or relicense those dependencies.

## Contributing

By submitting feedback, code, or other contributions, please ensure you have the right to do so. Contributions intended for inclusion in LegeRok must be compatible with the repository license and may be used, modified, and distributed by the contributor under the terms of the Prosperity Public License 3.0.0.
