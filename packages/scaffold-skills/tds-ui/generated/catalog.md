# tds-ui Catalog Projection

- package: `@toss/tds-react-native@2.0.2`
- last verified: `2026-03-19`
- truth source: `generated/catalog.json`

## input-choice

- `checkbox`, `dropdown`, `keypad`, `numeric-spinner`, `radio`, `rating`, `search-field`, `segmented-control`, `slider`, `switch`, `tab`, `text-field`

## actions-feedback

- `button`, `dialog`, `error-page`, `icon-button`, `loader`, `progress-bar`, `result`, `skeleton`, `text-button`, `toast`

## list-navigation-layout

- `board-row`, `border`, `grid-list`, `list`, `list-footer`, `list-header`, `list-row`, `navbar`, `stepper-row`, `table-row`
- anomaly: `navbar` is docs-backed, but use the catalog `rootImportPath`
- anomaly: `stepper-row` docs slug is `stepper`

## content-display

- `amount-top`, `asset`, `badge`, `bottom-info`, `carousel`, `chart`, `gradient`, `highlight`, `post`, `shadow`
- anomaly: `chart` docs slug is `Chart/bar-chart`

## guarded-export-only

- `agreement`, `bottom-cta`, `bottom-sheet`, `fixed-bottom-cta`, `icon`, `tooltip`, `top`, `txt`
- gate these by default and include a doc-backed fallback in the answer

## blocked-by-default

- `paragraph`
- do not recommend by default
