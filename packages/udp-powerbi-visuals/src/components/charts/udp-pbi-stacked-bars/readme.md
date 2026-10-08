# udp-pbi-stacked-bars



<!-- Auto Generated Below -->


## Overview

Horizontal bars split by series (FT "part-to-whole" and "deviation"): stacked, 100 % (spine),
diverging around a neutral middle (Likert: condition grades, satisfaction) or grouped side by
side. For categories with long names. Segments keep one colour per series (a palette by meaning:
nominal, ordered, bad ↔ good) with a legend near the title; shares sit inside ramp segments when
they fit. Hover or the arrow keys (↑ ↓ categories, ← → segments) show the tooltip; a click
reports the category and the segment's series.

## Properties

| Property           | Attribute            | Description                                                                                                                                                                             | Type                                                 | Default           |
| ------------------ | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------- |
| `calc`             | `calc`               | Curtain: how it is calculated, one line.                                                                                                                                                | `string \| undefined`                                | `undefined`       |
| `categories`       | --                   | One row per category, in display order (or ranked with `sort`).                                                                                                                         | `ChartCategory[]`                                    | `[]`              |
| `categoryLabel`    | `category-label`     | Header of the category column in the table view and the export.                                                                                                                         | `string`                                             | `'Category'`      |
| `crossFilterField` | `cross-filter-field` | Column reference a click on a category filters.                                                                                                                                         | `string \| undefined`                                | `undefined`       |
| `emptyMessage`     | `empty-message`      |                                                                                                                                                                                         | `string \| undefined`                                | `undefined`       |
| `error`            | `error`              |                                                                                                                                                                                         | `string \| undefined`                                | `undefined`       |
| `exportFileName`   | `export-file-name`   |                                                                                                                                                                                         | `string \| undefined`                                | `undefined`       |
| `exportFormats`    | --                   |                                                                                                                                                                                         | `ExportFormat[]`                                     | `['csv', 'xlsx']` |
| `exportRows`       | --                   | Raw query rows to export instead of the visual's table.                                                                                                                                 | `TableRow[] \| undefined`                            | `undefined`       |
| `exportable`       | `exportable`         |                                                                                                                                                                                         | `boolean`                                            | `true`            |
| `focusable`        | `focusable`          |                                                                                                                                                                                         | `boolean`                                            | `true`            |
| `format`           | --                   |                                                                                                                                                                                         | `FormatSpec \| undefined`                            | `undefined`       |
| `frame`            | `frame`              | card: the Univerus template card (header, toolbar, curtain, focus view). none: the visual alone, to compose inside a host card (UDP: udp-fluent-card); states and events are unchanged. | `"card" \| "none"`                                   | `'card'`          |
| `heading`          | `heading`            | Card title (`title` is a global HTML attribute, hence `heading`).                                                                                                                       | `string`                                             | `''`              |
| `index`            | `index`              | Entrance stagger position.                                                                                                                                                              | `number`                                             | `0`               |
| `info`             | `info`               | Curtain: what the chart means, one sentence.                                                                                                                                            | `string \| undefined`                                | `undefined`       |
| `interactive`      | `interactive`        | A click emits `dataPointClick` (default: when a field is set).                                                                                                                          | `boolean \| undefined`                               | `undefined`       |
| `label`            | `label`              | Accessible name of the chart; defaults to the heading.                                                                                                                                  | `string \| undefined`                                | `undefined`       |
| `labels`           | `labels`             | auto: totals and, on ramp palettes, shares inside segments where they fit; none: tooltip and table only.                                                                                | `"auto" \| "none"`                                   | `'auto'`          |
| `layout`           | `layout`             | stacked (magnitude), percent (each row 100 %), diverging (Likert, around 0), grouped (side by side).                                                                                    | `"diverging" \| "grouped" \| "percent" \| "stacked"` | `'stacked'`       |
| `loading`          | `loading`            |                                                                                                                                                                                         | `boolean`                                            | `false`           |
| `loadingRows`      | `loading-rows`       |                                                                                                                                                                                         | `number`                                             | `5`               |
| `negativeSeries`   | --                   | diverging: series (ids) drawn left of the axis, e.g. Poor, Very poor.                                                                                                                   | `string[]`                                           | `[]`              |
| `neutralSeries`    | --                   | diverging: series (ids) split across the axis, e.g. Fair.                                                                                                                               | `string[]`                                           | `[]`              |
| `palette`          | `palette`            | Nominal series (categorical), ordered grades (sequential) or bad ↔ good (diverging).                                                                                                    | `"categorical" \| "diverging" \| "sequential"`       | `'categorical'`   |
| `selectedSeries`   | `selected-series`    | The selected series (raw value or id): other series dim.                                                                                                                                | `boolean \| null \| number \| string \| undefined`   | `undefined`       |
| `selectedValue`    | `selected-value`     | The selected category (its raw value or id): the others dim.                                                                                                                            | `boolean \| null \| number \| string \| undefined`   | `undefined`       |
| `series`           | --                   | The parts, each with one value per category; their order is the stacking order.                                                                                                         | `ChartSeries[]`                                      | `[]`              |
| `seriesField`      | `series-field`       | Column reference of the series dimension: a click on a segment also filters it.                                                                                                         | `string \| undefined`                                | `undefined`       |
| `sort`             | `sort`               | none keeps the order received; desc / asc rank rows by total.                                                                                                                           | `"asc" \| "desc" \| "none"`                          | `'none'`          |
| `stale`            | `stale`              | Previous filters' data shown (dimmed) while the new query runs.                                                                                                                         | `boolean`                                            | `false`           |
| `subheading`       | `subheading`         |                                                                                                                                                                                         | `string \| undefined`                                | `undefined`       |
| `tableToggle`      | `table-toggle`       |                                                                                                                                                                                         | `boolean`                                            | `true`            |
| `testIdPrefix`     | `test-id-prefix`     |                                                                                                                                                                                         | `string \| undefined`                                | `undefined`       |
| `theme`            | `theme`              | Pins this element to a template regardless of <html data-theme>.                                                                                                                        | `"neoglass" \| "nocturne" \| undefined`              | `undefined`       |
| `topN`             | `top-n`              | Keep the N largest categories; the rest fold into "Other".                                                                                                                              | `number \| undefined`                                | `undefined`       |
| `visualId`         | `visual-id`          | Identifies the visual in its events.                                                                                                                                                    | `string \| undefined`                                | `undefined`       |


## Events

| Event             | Description | Type                                |
| ----------------- | ----------- | ----------------------------------- |
| `dataPointClick`  |             | `CustomEvent<DataPointClickDetail>` |
| `exportData`      |             | `CustomEvent<ExportDetail>`         |
| `focusModeChange` |             | `CustomEvent<FocusModeDetail>`      |
| `viewChange`      |             | `CustomEvent<ViewChangeDetail>`     |


## Dependencies

### Depends on

- [udp-pbi-data-table](../../tables/udp-pbi-data-table)

### Graph
```mermaid
graph TD;
  udp-pbi-stacked-bars --> udp-pbi-data-table
  style udp-pbi-stacked-bars fill:#f9f,stroke:#333,stroke-width:4px
```

----------------------------------------------

*Generated by Stencil from the component source. Do not edit by hand.*
