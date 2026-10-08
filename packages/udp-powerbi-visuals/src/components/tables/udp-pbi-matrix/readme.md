# udp-pbi-matrix



<!-- Auto Generated Below -->


## Overview

Matrix (Lens matrix; FT XY heatmap, e.g. the criticality × condition risk matrix): hierarchical
rows (1–3 levels, expand / collapse), an optional column dimension and several measures, each
optionally heat-mapped with a token ramp (sequential, or diverging by business meaning). Totals
and subtotals are passed in from the engine, never summed here. A WAI-ARIA treegrid: one tab stop,
arrows move between cells, → / ← expand and collapse, Enter / Space select. A click on a cell
reports its row and column (`filters`), on a row header its row.

## Properties

| Property           | Attribute            | Description                                                                                                                                                                             | Type                                               | Default           |
| ------------------ | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------- |
| `calc`             | `calc`               | Curtain: how it is calculated, one line.                                                                                                                                                | `string \| undefined`                              | `undefined`       |
| `columnField`      | `column-field`       | Column reference of the column dimension: a click on a cell also filters it.                                                                                                            | `string \| undefined`                              | `undefined`       |
| `columnHeader`     | `column-header`      | Caption above the column members, e.g. 'Condition grade'.                                                                                                                               | `string \| undefined`                              | `undefined`       |
| `columns`          | --                   | Members of the column dimension (none: one column per measure).                                                                                                                         | `MatrixColumn[]`                                   | `[]`              |
| `crossFilterField` | `cross-filter-field` | Column reference of the top row level (shorthand for `rowFields[0]`).                                                                                                                   | `string \| undefined`                              | `undefined`       |
| `emptyMessage`     | `empty-message`      |                                                                                                                                                                                         | `string \| undefined`                              | `undefined`       |
| `error`            | `error`              |                                                                                                                                                                                         | `string \| undefined`                              | `undefined`       |
| `expandLevel`      | `expand-level`       | Row levels open on load (0: only the top rows; 1: their children too…).                                                                                                                 | `number`                                           | `0`               |
| `exportFileName`   | `export-file-name`   |                                                                                                                                                                                         | `string \| undefined`                              | `undefined`       |
| `exportFormats`    | --                   |                                                                                                                                                                                         | `ExportFormat[]`                                   | `['csv', 'xlsx']` |
| `exportRows`       | --                   | Raw query rows to export instead of the flattened matrix.                                                                                                                               | `TableRow[] \| undefined`                          | `undefined`       |
| `exportable`       | `exportable`         |                                                                                                                                                                                         | `boolean`                                          | `true`            |
| `focusable`        | `focusable`          |                                                                                                                                                                                         | `boolean`                                          | `true`            |
| `format`           | --                   | Default format of the measures (each measure may set its own).                                                                                                                          | `FormatSpec \| undefined`                          | `undefined`       |
| `frame`            | `frame`              | card: the Univerus template card (header, toolbar, curtain, focus view). none: the visual alone, to compose inside a host card (UDP: udp-fluent-card); states and events are unchanged. | `"card" \| "none"`                                 | `'card'`          |
| `grandTotal`       | --                   | The grand-total row from the engine (cells per column, `total` for the corner).                                                                                                         | `MatrixNode \| undefined`                          | `undefined`       |
| `heading`          | `heading`            | Card title (`title` is a global HTML attribute, hence `heading`).                                                                                                                       | `string`                                           | `''`              |
| `index`            | `index`              | Entrance stagger position.                                                                                                                                                              | `number`                                           | `0`               |
| `info`             | `info`               | Curtain: what the matrix means, one sentence.                                                                                                                                           | `string \| undefined`                              | `undefined`       |
| `interactive`      | `interactive`        | Clicks emit `dataPointClick` (default: when a field is set).                                                                                                                            | `boolean \| undefined`                             | `undefined`       |
| `label`            | `label`              | Accessible name of the grid; defaults to the heading.                                                                                                                                   | `string \| undefined`                              | `undefined`       |
| `loading`          | `loading`            |                                                                                                                                                                                         | `boolean`                                          | `false`           |
| `loadingRows`      | `loading-rows`       |                                                                                                                                                                                         | `number`                                           | `5`               |
| `maxHeight`        | `max-height`         | Scroll inside the card past this height (px); the header row and first column stay put.                                                                                                 | `number`                                           | `440`             |
| `measures`         | --                   |                                                                                                                                                                                         | `MatrixMeasure[]`                                  | `[]`              |
| `nodes`            | --                   | The row tree.                                                                                                                                                                           | `MatrixNode[]`                                     | `[]`              |
| `rowFields`        | --                   | Column reference per row level, top first: a click on a row filters its own level.                                                                                                      | `string[]`                                         | `[]`              |
| `rowLevels`        | --                   | Header of each row level, top first, e.g. ['Group', 'Class'].                                                                                                                           | `string[]`                                         | `[]`              |
| `selectedColumn`   | `selected-column`    | The selected column member (raw value or id).                                                                                                                                           | `boolean \| null \| number \| string \| undefined` | `undefined`       |
| `selectedValue`    | `selected-value`     | The selected row (raw value or id, at any level).                                                                                                                                       | `boolean \| null \| number \| string \| undefined` | `undefined`       |
| `stale`            | `stale`              | Previous filters' data shown (dimmed) while the new query runs.                                                                                                                         | `boolean`                                          | `false`           |
| `subheading`       | `subheading`         |                                                                                                                                                                                         | `string \| undefined`                              | `undefined`       |
| `testIdPrefix`     | `test-id-prefix`     |                                                                                                                                                                                         | `string \| undefined`                              | `undefined`       |
| `theme`            | `theme`              | Pins this element to a template regardless of <html data-theme>.                                                                                                                        | `"neoglass" \| "nocturne" \| undefined`            | `undefined`       |
| `visualId`         | `visual-id`          | Identifies the visual in its events.                                                                                                                                                    | `string \| undefined`                              | `undefined`       |


## Events

| Event             | Description | Type                                |
| ----------------- | ----------- | ----------------------------------- |
| `dataPointClick`  |             | `CustomEvent<DataPointClickDetail>` |
| `exportData`      |             | `CustomEvent<ExportDetail>`         |
| `focusModeChange` |             | `CustomEvent<FocusModeDetail>`      |
| `viewChange`      |             | `CustomEvent<ViewChangeDetail>`     |


----------------------------------------------

*Generated by Stencil from the component source. Do not edit by hand.*
