# Orchestrator Processes Dashboard

## Overview
A UiPath Coded Web App that lists all Orchestrator process releases for the authenticated user's tenant. Users can search, filter by package type, and paginate through results. The dashboard surfaces key stats (total count, up-to-date vs outdated) and shows process metadata including folder, version, framework, and last-modified date.

## Tech Stack
- **React 18** + **TypeScript** — UI framework
- **Vite** — dev server and bundler (base: `'./'`, `path-browserify` alias)
- **Tailwind CSS** — utility-first styling
- **@uipath/uipath-typescript** — UiPath SDK (`Processes` service from `/processes` subpath)
- **PKCE OAuth** — via `src/hooks/useAuth.tsx` (pre-scaffolded)

## Features
- Sign-in gate with UiPath PKCE OAuth
- Sidebar navigation with active state (Processes, Jobs, Queues, Assets, Settings, Help, Logout)
- Topbar with live search (debounced 350 ms, server-side OData `filter`)
- Stat cards: Total Processes, Up to Date, Outdated, Latest Modified
- Process type filter tabs (All / Orchestration / Process / API / Agent / Web App) with live counts
- Paginated table (25 per page) with prev/next navigation and "Showing X–Y of Z" footer
- Per-row: colored avatar, name + description, folder, type badge, version, framework, modified date, Latest/Outdated status pill
- Refresh button to re-fetch the current page

## Project Structure
```
src/
  App.tsx                      — Auth gate + AuthProvider wrapper
  components/
    ProcessesDashboard.tsx     — Main dashboard: data fetching, stat cards, filter tabs, table, pagination
  hooks/
    useAuth.tsx                — PKCE OAuth hook (scaffold, do not modify)
uipath.json                    — SDK config: clientId, scopes, orgName, tenantName, baseUrl
AGENTS.md                      — This file
```

## Data & Integrations
- **UiPath Processes SDK** (`@uipath/uipath-typescript/processes`) — `Processes.getAll()` with `pageSize: 25`, cursor-based pagination, OData `filter` for search
- **OAuth scope required**: `OR.Execution.Read` (already in `uipath.json`)
- State: React `useState` for process list, pagination cursors (Map<page, cursor>), loading, error, search, filter type
- No external databases or Data Fabric entities

## Conventions
- Subpath imports for all SDK services: `import { Processes } from '@uipath/uipath-typescript/processes'`
- Services instantiated with `useMemo(() => new Processes(sdk), [sdk])`
- Pagination: cursor-based; store `nextCursor` in a `Map<pageNumber, cursor>` keyed by target page
- Tailwind only — no CSS modules or inline styles
- Color palette: green-900 (`#14532d`) as primary accent, white cards, gray-50 background
- Rounded corners: `rounded-xl` for inputs/buttons, `rounded-2xl` for cards/table container

## Changelog

### 2026-07-02 — Initial build
Built the Orchestrator Processes Dashboard: sidebar + topbar shell, live search with debounce, type filter tabs, stat cards, paginated table with cursor navigation, OAuth sign-in gate. Fetches real process data from UiPath Orchestrator via the `@uipath/uipath-typescript/processes` SDK.