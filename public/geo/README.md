# Boundary sets for the map visuals

The map elements (`udp-pbi-point-map`, `udp-pbi-choropleth`) draw these boundaries. The app serves them from
its own origin, so maps work offline, need no API key and cost nothing. `index.json` is the catalogue a
manifest's `geo.set` refers to.

| File | Objects | Feature properties | Source |
| :--- | :--- | :--- | :--- |
| `world-110m.topo.json` | `countries` | `name`, `code` (ISO 3166-1 alpha-3) | Natural Earth 1:110m admin 0, v5.1.2 |
| `na-admin1.topo.json` | `regions` (US states, DC, Canadian provinces and territories) · `context` (neighbouring countries, drawn as land) | `name`, `code` (ISO 3166-2, e.g. `US-NY`), `postal`, `country` | Natural Earth 1:50m admin 1 and admin 0, v5.1.2, simplified to 6 % of the vertices, detached islands under 0.15 square degrees dropped |
| `na-tiles.json` | — | `tiles`: ISO 3166-2 code → `[column, row]` of the equal-area tile grid | Authored for this project |

**Licence.** Natural Earth data is in the public domain (naturalearthdata.com/about/terms-of-use); no
attribution is required; `index.json` records the source of each set. The tile grid is part of this repository.

**Rebuild** with `node scripts/build-geo.mjs` (downloads Natural Earth at the pinned tag into a temporary
folder). **Custom boundaries** (service areas, wards, communities exported from QGIS as TopoJSON or
GeoJSON in WGS 84) can be added here and referenced by path from a manifest (`geo.set: "my-areas.topo.json"`).
