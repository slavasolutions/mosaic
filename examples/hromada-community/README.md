# Example: Hromada Community

A reference Mosaic 0.8 site. Read this directory top-to-bottom to see every spec rule in working form.

## What's exercised here

| Spec rule                          | Where to look                                                    |
|------------------------------------|------------------------------------------------------------------|
| Root layout                        | This directory                                                   |
| `mosaic.json` schema (0.8 full manifest) | `mosaic.json` (types, collections w/ defaults, singletons, redirects) |
| Direct `.md` record                | `collections/news/2025-03-12-launch.md`                          |
| Direct `.md` + `.json` sidecar     | `collections/news/2025-04-02-grant.{md,json}`                    |
| Folder record with co-located asset | `collections/news/2025-05-15-recap/`                            |
| Direct `.json` only                | `collections/team/ben.json`                                      |
| Folder record + relative refs      | `collections/team/anna/` (refs `./bio.md`, `./photo.jpg`)         |
| Sidecar where md provides title    | `collections/team/maria.{md,json}` (no `title` in JSON, H1 wins — see MIP-0010) |
| Composed homepage with sections    | `pages/index.json` + `pages/index.md`                            |
| Plain prose page                   | `pages/about.md`                                                 |
| Folder-shape page                  | `pages/annual-report-2024/` (with co-located `cover.jpg`)        |
| Data-only page                     | `pages/contact.json`                                             |
| Root-level singletons              | `site.json`, `header.json`, `footer.json`, `tokens.json` at the site root |
| Design tokens singleton (DTCG)     | `tokens.json` — color, font, space tokens                        |
| Redirects                          | `mosaic.json#redirects` — `/news/launch` → `/news/2025-03-12-launch` |
| Default sort + mount per collection | `mosaic.json#collections` — `news` (`date desc` /news), `team` (`title asc` /team), `services` (/services), `events` (`date asc` /events) |
| Home is `/`                        | `pages/index.{json,md}` mints `/`; no `pages/home.*` exists      |
| `collection-list` routing          | `pages/news.json`, `pages/services.json`, `pages/team.json`, `pages/events.json` |
| Multiple mounts of same collection | `pages/index.json` (limit 3) and `pages/news.json` (limit 20) both mount `collections/news` |
| `ref:` resolution                  | Throughout (`ref:team/anna`, `ref:services/settlement`, etc.)    |
| `asset:` resolution                | `header.json` (`asset:images/logo.svg`)                          |
| Relative `./` refs                 | `collections/team/anna/index.json`, `pages/annual-report-2024/index.json` (`./cover.jpg`, `./index.md`) |
| Selectors                          | `footer.json`, `pages/contact.json` (`ref:site@contact.email`)   |
| Circular refs                      | `collections/team/anna` ↔ `team/ben` ↔ `team/maria` (colleagues) |

## Expected routes

| URL                       | Source                                          |
|---------------------------|-------------------------------------------------|
| `/`                       | `pages/index.{json,md}`                         |
| `/about`                  | `pages/about.md`                                |
| `/services`               | `pages/services.json`                           |
| `/services/settlement`    | `collections/services/settlement.{json,md}` via `pages/services.json` |
| `/services/language`      | `collections/services/language.{json,md}`       |
| `/services/culture`       | `collections/services/culture.{json,md}`        |
| `/news`                   | `pages/news.json`                               |
| `/news/2025-03-12-launch` | `collections/news/2025-03-12-launch.md`         |
| `/news/2025-04-02-grant`  | `collections/news/2025-04-02-grant.{json,md}`   |
| `/news/2025-05-15-recap`  | `collections/news/2025-05-15-recap/`            |
| `/team`                   | `pages/team.json`                               |
| `/team/anna`              | `collections/team/anna/`                        |
| `/team/ben`               | `collections/team/ben.json`                     |
| `/team/maria`             | `collections/team/maria.{json,md}`              |
| `/events`                 | `pages/events.json`                             |
| `/events/autumn-festival` | `collections/events/autumn-festival.json`       |
| `/events/open-house`      | `collections/events/open-house.json`            |
| `/contact`                | `pages/contact.json`                            |
| `/annual-report-2024`     | `pages/annual-report-2024/`                     |

## Expected redirects

| From              | To                          | Status | Source            |
|-------------------|-----------------------------|--------|-------------------|
| `/news/launch`    | `/news/2025-03-12-launch`   | 301    | `mosaic.json`     |
| `/home`           | `/`                         | 301    | auto (§3.2)       |
