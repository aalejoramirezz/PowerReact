import { z } from 'zod';
import { hasSingleTopLevelEvaluate } from './daxInjection';

/**
 * The manifest contract: a JSON description of a report (data source, 12-column grid, visuals with
 * their DAX, field mappings and presentation props) that PowerReact renders with the Univerus web
 * components. Univerus-Lens validates against the JSON Schema generated from this file
 * (public/manifests/manifest.schema.json, `npm run manifest:schema`).
 *
 * Conventions: `fields` map the query's result columns to the component's data; `props` only
 * change presentation. Objects are strict, so a misspelt key is reported instead of ignored.
 */

/** `'table'[Column]` or `table[Column]`: a model column (filters, categories). */
export const COLUMN_REF = /^'(?:[^']|'')+'\[[^\]]+\]$|^[A-Za-z_][\w ]*\[[^\]]+\]$/;
/** `[Name]`: a result column the query defines ("Name", <expression>). */
const MEASURE_KEY = /^\[[^\]]+\]$/;
/** Either of the two: any key of an executeQueries row. */
const FIELD_KEY = /^(?:'(?:[^']|'')+'|[A-Za-z_][\w ]*)?\[[^\]]+\]$/;

const ColumnRef = z.string().regex(COLUMN_REF, "Expected a column reference like 'table'[Column]");
const MeasureKey = z.string().regex(MEASURE_KEY, 'Expected a result column like [Measure]');
const FieldKey = z.string().regex(FIELD_KEY, "Expected a result column like [Measure] or 'table'[Column]");

/** Icons a KPI can name; kept in sync with KPI_ICONS in the web components (tested). */
export const KPI_ICON_NAMES = [
  'activity',
  'alert-triangle',
  'boxes',
  'building',
  'calendar',
  'check-circle',
  'clipboard-check',
  'clock',
  'database',
  'dollar',
  'droplets',
  'factory',
  'gauge',
  'layers',
  'map-pin',
  'package',
  'percent',
  'route',
  'shield-check',
  'target',
  'timer',
  'trending-down',
  'trending-up',
  'truck',
  'users',
  'wrench',
  'zap',
] as const;

const Format = z.strictObject({
  style: z.enum(['integer', 'decimal', 'percent', 'currency', 'compact']),
  decimals: z.int().min(0).max(6).optional(),
  currency: z
    .string()
    .regex(/^[A-Za-z]{3}$/, 'Expected an ISO 4217 code like "USD"')
    .optional(),
});

const Export = z.strictObject({
  csv: z.boolean().default(true),
  xlsx: z.boolean().default(true),
  fileName: z.string().min(1).max(80).optional(),
  /** `visual`: what the visual shows (its table view); `query`: the raw query rows. */
  source: z.enum(['visual', 'query']).default('visual'),
});

const Tone = z.enum(['ok', 'warn', 'bad', 'accent']);

/** Extra measures shown in a mark's tooltip (Lens `tooltips`), also exported with the visual's table. */
const Tooltips = z.array(z.strictObject({ field: FieldKey, label: z.string().min(1).max(60), format: Format.optional() })).max(6);

/** A target, average or threshold drawn across a plot. */
const ReferenceLine = z.strictObject({ value: z.number(), label: z.string().max(40).optional() });


/** Presentation props every visual takes. */
const baseProps = {
  title: z.string().min(1).max(120),
  subtitle: z.string().max(240).optional(),
  /** Curtain: what it means, one sentence. */
  info: z.string().max(400).optional(),
  /** Curtain: the measure or formula, one line. */
  calc: z.string().max(240).optional(),
  format: Format.optional(),
  export: Export.optional(),
  focusMode: z.boolean().default(true),
  /** Pins this visual to a template whatever the app theme. */
  theme: z.enum(['neoglass', 'nocturne']).optional(),
};
/** Charts also have a table view and an empty-state message. */
const chartProps = {
  ...baseProps,
  tableView: z.boolean().default(true),
  emptyMessage: z.string().max(200).optional(),
};

const common = {
  id: z.string().regex(/^[a-z][\w-]*$/, 'Lowercase letters, digits, "-" and "_", starting with a letter'),
  grid: z.strictObject({
    colSpan: z.int().min(1).max(12),
    rowSpan: z.int().min(1).max(6).default(1),
  }),
  query: z.strictObject({
    dax: z.string().min(1).refine(hasSingleTopLevelEvaluate, 'Exactly one top-level EVALUATE'),
  }),
  /** The column a click on this visual filters (`emit`), and whether it obeys the others (`respect`). */
  crossFilter: z
    .strictObject({
      field: ColumnRef,
      emit: z.boolean().default(true),
      respect: z.boolean().default(true),
    })
    .optional(),
  /** Offline rows with the same shape as the query's result (the preview's Sample mode). */
  sample: z.array(z.record(z.string(), z.unknown())).max(5000).optional(),
};

const KpiCard = z.strictObject({
  component: z.literal('UniverusKpiCard'),
  ...common,
  fields: z.strictObject({ value: MeasureKey, comparison: MeasureKey.optional(), meter: MeasureKey.optional() }),
  props: z.strictObject({
    ...baseProps,
    icon: z.enum(KPI_ICON_NAMES).optional(),
    caption: z.string().max(40).optional(),
    goodWhen: z.enum(['higher', 'lower']).default('higher'),
    deltaLabel: z.string().max(40).optional(),
    meterLabel: z.string().max(80).optional(),
    meterDetail: z.string().max(40).optional(),
  }),
});

const KpiHero = z.strictObject({
  component: z.literal('UniverusKpiHero'),
  ...common,
  fields: z.strictObject({
    value: MeasureKey,
    comparison: MeasureKey.optional(),
    meter: MeasureKey.optional(),
    metrics: z
      .array(z.strictObject({ label: z.string().min(1).max(60), field: MeasureKey, format: Format.optional() }))
      .max(4)
      .optional(),
  }),
  props: z.strictObject({
    ...baseProps,
    unit: z.string().max(12).optional(),
    goodWhen: z.enum(['higher', 'lower']).default('higher'),
    deltaLabel: z.string().max(40).optional(),
    meterLabel: z.string().max(80).optional(),
  }),
});

const categoryValue = z.strictObject({ category: ColumnRef, value: MeasureKey });

const SpotlightBars = z.strictObject({
  component: z.literal('UniverusSpotlightBars'),
  ...common,
  fields: categoryValue,
  props: z.strictObject({
    ...chartProps,
    topN: z.int().min(0).max(100).default(0),
    rank: z.boolean().default(false),
    secondary: z.enum(['share', 'share-paren', 'none']).default('share'),
    selectedBadge: z.string().max(40).optional(),
  }),
});

const RankingBars = z.strictObject({
  component: z.literal('UniverusRankingBars'),
  ...common,
  fields: categoryValue,
  props: z.strictObject({
    ...chartProps,
    topN: z.int().min(0).max(100).default(8),
    order: z.enum(['desc', 'asc']).default('desc'),
    /** bar: the slim pill; lollipop: a hairline ending in a dot. */
    mark: z.enum(['bar', 'lollipop']).default('bar'),
  }),
});

const BulletBars = z.strictObject({
  component: z.literal('UniverusBulletBars'),
  ...common,
  fields: z.strictObject({ category: ColumnRef, actual: MeasureKey, target: MeasureKey }),
  props: z.strictObject({
    ...chartProps,
    goodWhen: z.enum(['above', 'below']).default('above'),
    topN: z.int().min(0).max(100).default(8),
    targetLabel: z.string().max(40).default('Target'),
  }),
});

const DivergingBars = z.strictObject({
  component: z.literal('UniverusDivergingBars'),
  ...common,
  fields: categoryValue,
  props: z.strictObject({
    ...chartProps,
    negativeLabel: z.string().max(40).default('Negative'),
    positiveLabel: z.string().max(40).default('Positive'),
    maxRows: z.int().min(2).max(60).default(16),
  }),
});

const Donut = z.strictObject({
  component: z.literal('UniverusDonut'),
  ...common,
  fields: categoryValue,
  props: z.strictObject({
    ...chartProps,
    centerLabel: z.string().max(40).default('total'),
  }),
});

const TrendChart = z.strictObject({
  component: z.literal('UniverusTrendChart'),
  ...common,
  /** Rows in time order (ORDER BY in the query); `comparison` adds the dashed second series. */
  fields: z.strictObject({ category: ColumnRef, value: MeasureKey, comparison: MeasureKey.optional(), tooltips: Tooltips.optional() }),
  props: z.strictObject({
    ...chartProps,
    seriesLabel: z.string().max(40).optional(),
    comparisonLabel: z.string().max(40).optional(),
    area: z.boolean().default(true),
    directLabels: z.boolean().default(true),
    /** Shade the gap to the comparison (surplus / deficit) instead of the area. */
    gap: z.boolean().default(false),
    /** gap: whether the primary series above the comparison is favourable. */
    goodWhen: z.enum(['higher', 'lower']).default('higher'),
    referenceLines: z.array(ReferenceLine).max(4).optional(),
    chartHeight: z.int().min(160).max(640).default(260),
  }),
});

const IbcsVariance = z.strictObject({
  component: z.literal('UniverusIbcsVariance'),
  ...common,
  fields: z.strictObject({ category: ColumnRef, actual: MeasureKey, comparison: MeasureKey }),
  props: z.strictObject({
    ...chartProps,
    orientation: z.enum(['horizontal', 'vertical']).default('horizontal'),
    scenario: z.enum(['PY', 'PL', 'FC', 'BU']).default('PY'),
    goodWhen: z.enum(['higher', 'lower']).default('higher'),
    actualLabel: z.string().max(12).default('AC'),
    comparisonLabel: z.string().max(12).optional(),
    sort: z.enum(['actual', 'variance', 'natural']).optional(),
    topN: z.int().min(0).max(100).default(0),
    pctCap: z.number().min(0.1).max(10).default(2),
    decimals: z.int().min(0).max(3).default(1),
    chartHeight: z.int().min(240).max(720).default(420),
  }),
});

const DataTable = z.strictObject({
  component: z.literal('UniverusDataTable'),
  ...common,
  fields: z.strictObject({
    columns: z
      .array(
        z.strictObject({
          field: FieldKey,
          label: z.string().min(1).max(60),
          kind: z.enum(['text', 'number', 'meter', 'status']).optional(),
          format: Format.optional(),
          /** meter: the 0..1 result column drawn as a mini meter. */
          ratioField: FieldKey.optional(),
          suffix: z.string().max(20).optional(),
          tone: Tone.optional(),
          emptyLabel: z.string().max(40).optional(),
        })
      )
      .min(1)
      .max(20),
    /** Identifies a row (selection, click value). Default: the first column. */
    rowKey: FieldKey.optional(),
  }),
  props: z.strictObject({
    ...baseProps,
    emptyMessage: z.string().max(200).optional(),
    paginated: z.boolean().default(true),
    pageSize: z.union([z.literal(10), z.literal(25), z.literal(50)]).default(10),
    maxHeight: z.int().min(160).max(1200).optional(),
  }),
});

/**
 * Category × series data, in one of two shapes:
 * - long: one row per category × series, `series` names the part and `value` holds the measure;
 * - wide: one row per category, `values` lists one measure per series.
 * A single measure (`value` without `series`) draws one series.
 */
const SeriesFields = z
  .strictObject({
    /** A model column, or a column the query builds (e.g. age bands from DATATABLE: not cross-filterable). */
    category: FieldKey,
    series: ColumnRef.optional(),
    value: MeasureKey.optional(),
    values: z
      .array(z.strictObject({ field: MeasureKey, label: z.string().min(1).max(60) }))
      .min(1)
      .max(12)
      .optional(),
    tooltips: Tooltips.optional(),
  })
  .superRefine((f, ctx) => {
    if (Boolean(f.value) === Boolean(f.values)) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'Set either value (one measure, optionally split by series) or values (one measure per series)' });
    }
    if (f.series && f.values) ctx.addIssue({ code: 'custom', path: ['series'], message: 'series splits value; with values every measure is already a series' });
  });

/** A series named in props: its value (long shape) or its label (wide shape). */
const SeriesName = z.string().min(1).max(60);

const seriesProps = {
  /** Nominal series (categorical), ordered grades (sequential) or bad ↔ good (diverging). */
  palette: z.enum(['categorical', 'sequential', 'diverging']).default('categorical'),
  /** none keeps the query's order (ORDER BY): time, ordinal bands. */
  sort: z.enum(['none', 'desc', 'asc']).default('none'),
  /** Keep the N largest categories; the rest fold into "Other" (0: all). */
  topN: z.int().min(0).max(100).default(0),
  labels: z.enum(['auto', 'none']).default('auto'),
  /** Header of the category column in the table view and the export. */
  categoryLabel: z.string().max(40).optional(),
  /** Series in this order first (ordinal grades); the rest follow in query order. */
  seriesOrder: z.array(SeriesName).max(24).optional(),
};

const ColumnChart = z.strictObject({
  component: z.literal('UniverusColumnChart'),
  ...common,
  fields: SeriesFields,
  props: z.strictObject({
    ...chartProps,
    ...seriesProps,
    layout: z.enum(['grouped', 'stacked', 'percent']).default('stacked'),
    /** histogram: bins touch (bands from DAX, in order). */
    variant: z.enum(['column', 'histogram']).default('column'),
    referenceLines: z.array(ReferenceLine).max(4).optional(),
    chartHeight: z.int().min(160).max(640).default(260),
  }),
});

const StackedBars = z.strictObject({
  component: z.literal('UniverusStackedBars'),
  ...common,
  fields: SeriesFields,
  props: z.strictObject({
    ...chartProps,
    ...seriesProps,
    layout: z.enum(['stacked', 'percent', 'diverging', 'grouped']).default('stacked'),
    /** diverging: series drawn left of the axis (e.g. Poor, Very poor). */
    negativeSeries: z.array(SeriesName).max(12).optional(),
    /** diverging: series split across the axis (e.g. Fair). */
    neutralSeries: z.array(SeriesName).max(6).optional(),
  }),
});

const Scatter = z.strictObject({
  component: z.literal('UniverusScatter'),
  ...common,
  /** One row per category: x and y measures, an optional size (bubble area) and colour group. */
  fields: z.strictObject({
    category: ColumnRef,
    x: MeasureKey,
    y: MeasureKey,
    size: MeasureKey.optional(),
    group: ColumnRef.optional(),
    tooltips: Tooltips.optional(),
  }),
  props: z.strictObject({
    ...chartProps,
    xLabel: z.string().max(40).optional(),
    yLabel: z.string().max(40).optional(),
    sizeLabel: z.string().max(40).optional(),
    /** Format of x (`format` is y's). */
    xFormat: Format.optional(),
    sizeFormat: Format.optional(),
    xReference: ReferenceLine.optional(),
    yReference: ReferenceLine.optional(),
    /** With both references: [top-left, top-right, bottom-left, bottom-right]. */
    quadrantLabels: z.tuple([z.string().max(30), z.string().max(30), z.string().max(30), z.string().max(30)]).optional(),
    xZero: z.boolean().default(false),
    yZero: z.boolean().default(false),
    labelTop: z.int().min(0).max(20).default(5),
    categoryLabel: z.string().max(40).optional(),
    chartHeight: z.int().min(200).max(640).default(300),
  }),
});

const MatrixValue = z.strictObject({
  field: MeasureKey,
  label: z.string().min(1).max(60),
  format: Format.optional(),
  heatmap: z.enum(['none', 'sequential', 'diverging']).default('none'),
  /** diverging: the favourable side. */
  goodWhen: z.enum(['higher', 'lower']).default('higher'),
  /** diverging: the reference value (default 0). */
  center: z.number().optional(),
});

const Matrix = z.strictObject({
  component: z.literal('UniverusMatrix'),
  ...common,
  fields: z
    .strictObject({
      /** Row hierarchy, top level first. */
      rows: z.array(ColumnRef).min(1).max(3),
      /** Optional column dimension (pivot). */
      column: ColumnRef.optional(),
      values: z.array(MatrixValue).min(1).max(6),
      /**
       * ROLLUPADDISSUBTOTAL flags of the row levels, top first: a row whose flag at level k is true
       * is the subtotal of level k−1 (the grand total at level 0). Totals are never computed here.
       */
      rowTotals: z.array(MeasureKey).min(1).max(3).optional(),
      /** ROLLUPADDISSUBTOTAL flag of the column dimension: true on the row totals. */
      columnTotal: MeasureKey.optional(),
    })
    .superRefine((f, ctx) => {
      if (f.rowTotals && f.rowTotals.length !== f.rows.length) {
        ctx.addIssue({ code: 'custom', path: ['rowTotals'], message: 'One flag per row level (same length as rows)' });
      }
      if (f.columnTotal && !f.column) ctx.addIssue({ code: 'custom', path: ['columnTotal'], message: 'columnTotal needs column' });
    }),
  props: z.strictObject({
    ...baseProps,
    emptyMessage: z.string().max(200).optional(),
    /** Header of each row level, top first (default: the column names). */
    rowLevels: z.array(z.string().max(40)).max(3).optional(),
    /** Caption above the column members. */
    columnHeader: z.string().max(60).optional(),
    /** Top-level rows in this order first (ordinal text such as criticality); the rest follow in query order. */
    rowOrder: z.array(z.string().min(1).max(60)).max(40).optional(),
    /** Column members in this order first (e.g. Excellent → Very Poor); the rest follow in query order. */
    columnOrder: z.array(z.string().min(1).max(60)).max(40).optional(),
    /** Row levels open on load (0: only the top rows). */
    expandLevel: z.int().min(0).max(2).default(0),
    maxHeight: z.int().min(160).max(1200).default(440),
  }),
});

const Waterfall = z.strictObject({
  component: z.literal('UniverusWaterfall'),
  ...common,
  /**
   * One row per step in bridge order (ORDER BY). `kind` (a result column with start / delta /
   * subtotal / end) marks the levels; without it the first row starts, the last ends.
   */
  fields: z.strictObject({ category: FieldKey, value: MeasureKey, kind: FieldKey.optional(), tooltips: Tooltips.optional() }),
  props: z.strictObject({
    ...chartProps,
    goodWhen: z.enum(['higher', 'lower']).default('higher'),
    orientation: z.enum(['vertical', 'horizontal']).default('vertical'),
    /** auto: the axis starts near the lowest level (levels drawn broken) when movements are small. */
    baseline: z.enum(['zero', 'auto']).default('zero'),
    labels: z.enum(['auto', 'none']).default('auto'),
    categoryLabel: z.string().max(40).optional(),
    chartHeight: z.int().min(160).max(640).default(280),
  }),
});

const Treemap = z.strictObject({
  component: z.literal('UniverusTreemap'),
  ...common,
  /** One row per item: `levels` (group, then item), the size and an optional colour measure. */
  fields: z.strictObject({
    levels: z.array(ColumnRef).min(1).max(2),
    value: MeasureKey,
    color: MeasureKey.optional(),
    tooltips: Tooltips.optional(),
  }),
  props: z.strictObject({
    ...chartProps,
    colorLabel: z.string().max(40).optional(),
    colorFormat: Format.optional(),
    colorScale: z.enum(['sequential', 'diverging']).default('sequential'),
    goodWhen: z.enum(['higher', 'lower']).default('higher'),
    colorCenter: z.number().default(0),
    levelLabels: z.array(z.string().max(40)).max(2).optional(),
    chartHeight: z.int().min(200).max(800).default(320),
  }),
});

const CalendarHeatmap = z.strictObject({
  component: z.literal('UniverusCalendarHeatmap'),
  ...common,
  /** One row per day with a value (a date column and a measure). */
  fields: z.strictObject({ date: ColumnRef, value: MeasureKey, tooltips: Tooltips.optional() }),
  props: z.strictObject({
    ...chartProps,
    valueLabel: z.string().max(40).optional(),
    weekStart: z.enum(['monday', 'sunday']).default('monday'),
  }),
});

const DotPlot = z.strictObject({
  component: z.literal('UniverusDotPlot'),
  ...common,
  /** Two values per category: `from` (before, plan, a week ago) and `to` (after, actual, now). */
  fields: z.strictObject({ category: ColumnRef, from: MeasureKey, to: MeasureKey, tooltips: Tooltips.optional() }),
  props: z.strictObject({
    ...chartProps,
    variant: z.enum(['dumbbell', 'slope']).default('dumbbell'),
    fromLabel: z.string().max(40).default('Before'),
    toLabel: z.string().max(40).default('After'),
    goodWhen: z.enum(['higher', 'lower']).default('higher'),
    sort: z.enum(['none', 'to', 'change']).default('none'),
    categoryLabel: z.string().max(40).optional(),
    chartHeight: z.int().min(200).max(800).default(320),
  }),
});

const Timeline = z.strictObject({
  component: z.literal('UniverusTimeline'),
  ...common,
  /**
   * One row per item: its name, start and end dates, an optional lane and an optional tone column
   * (ok / warn / bad, e.g. computed in DAX from the end date against TODAY()).
   */
  fields: z.strictObject({
    item: FieldKey,
    start: FieldKey,
    end: FieldKey.optional(),
    lane: FieldKey.optional(),
    tone: FieldKey.optional(),
    tooltips: Tooltips.optional(),
  }),
  props: z.strictObject({
    ...chartProps,
    /** The "today" line: auto (the current day), none, or an ISO date. */
    today: z.union([z.enum(['auto', 'none']), z.iso.date()]).default('auto'),
    toneLabels: z.strictObject({ ok: z.string().max(40).optional(), warn: z.string().max(40).optional(), bad: z.string().max(40).optional() }).optional(),
    categoryLabel: z.string().max(40).optional(),
    laneLabel: z.string().max(40).optional(),
  }),
});

const BoxPlot = z.strictObject({
  component: z.literal('UniverusBoxplot'),
  ...common,
  /**
   * Engine statistics per category (`q1`, `median`, `q3`, optional `min` / `max` / `mean` /
   * `count`, e.g. PERCENTILEX.INC) or raw observations (`value`, one row each, ≤ 5,000 per category).
   */
  fields: z
    .strictObject({
      category: ColumnRef,
      value: FieldKey.optional(),
      min: MeasureKey.optional(),
      q1: MeasureKey.optional(),
      median: MeasureKey.optional(),
      q3: MeasureKey.optional(),
      max: MeasureKey.optional(),
      mean: MeasureKey.optional(),
      count: MeasureKey.optional(),
      tooltips: Tooltips.optional(),
    })
    .superRefine((f, ctx) => {
      const stats = Boolean(f.q1 && f.median && f.q3);
      if (stats === Boolean(f.value)) {
        ctx.addIssue({ code: 'custom', path: ['value'], message: 'Set either the statistics (q1, median, q3, …) or value (raw observations)' });
      }
    }),
  props: z.strictObject({
    ...chartProps,
    showMean: z.boolean().default(true),
    zero: z.boolean().default(false),
    categoryLabel: z.string().max(40).optional(),
  }),
});

const SlicerMode = z.enum(['auto', 'buttons', 'dropdown']);

/**
 * A slicer on the grid. Its query lists the options (`value`, the column it filters, and an
 * optional `count`); the selection filters every other visual (Power BI's slicer), and the options
 * respect the other filters unless `crossFilter.respect` is false.
 */
const Slicer = z.strictObject({
  component: z.literal('UniverusSlicer'),
  ...common,
  fields: z.strictObject({ value: ColumnRef, count: MeasureKey.optional() }),
  props: z.strictObject({
    title: z.string().min(1).max(120),
    subtitle: z.string().max(240).optional(),
    info: z.string().max(400).optional(),
    /** auto: buttons up to 6 options, a searchable list beyond. */
    mode: SlicerMode.default('auto'),
    multiple: z.boolean().default(true),
    allLabel: z.string().max(40).default('All'),
  }),
});

/** A report filter drawn in the dashboard toolbar (Lens `report_filters`), on any model column. */
const ReportFilter = z.strictObject({
  field: ColumnRef,
  label: z.string().min(1).max(60),
  mode: SlicerMode.default('dropdown'),
  multiple: z.boolean().default(true),
  /** Options query (default: the column's values, respecting the other filters). */
  dax: z.string().min(1).refine(hasSingleTopLevelEvaluate, 'Exactly one top-level EVALUATE').optional(),
});

const Visual = z.discriminatedUnion('component', [
  KpiCard,
  KpiHero,
  SpotlightBars,
  RankingBars,
  BulletBars,
  DivergingBars,
  Donut,
  TrendChart,
  IbcsVariance,
  DataTable,
  ColumnChart,
  StackedBars,
  Scatter,
  Matrix,
  Waterfall,
  Treemap,
  CalendarHeatmap,
  DotPlot,
  Timeline,
  BoxPlot,
  Slicer,
]);

/** Manifest components the React container draws itself (controls), not udp-powerbi-visuals elements. */
export const CONTROL_COMPONENTS = ['UniverusSlicer'] as const;

export const ManifestSchema = z
  .strictObject({
    $schema: z.string().optional(),
    schemaVersion: z.literal(1),
    id: z.string().regex(/^[a-z][\w-]*$/, 'Lowercase letters, digits, "-" and "_", starting with a letter'),
    title: z.string().min(1).max(120),
    eyebrow: z.string().max(60).optional(),
    description: z.string().max(400).optional(),
    /** Applied once when the manifest loads; after that the user's theme toggle wins. */
    theme: z.enum(['neoglass', 'nocturne', 'auto']).default('auto'),
    dataSource: z.strictObject({ workspaceId: z.guid(), semanticModelId: z.guid() }),
    layout: z
      .strictObject({
        columns: z.literal(12).default(12),
        rowMinHeight: z.int().min(80).max(480).default(120),
      })
      .default({ columns: 12, rowMinHeight: 120 }),
    /** Report filters in the toolbar; a filter with a visible control is not repeated as a chip. */
    filters: z.array(ReportFilter).max(8).optional(),
    visuals: z.array(Visual).min(1).max(40),
  })
  .superRefine((manifest, ctx) => {
    const seen = new Map<string, number>();
    manifest.visuals.forEach((visual, i) => {
      const first = seen.get(visual.id);
      if (first === undefined) seen.set(visual.id, i);
      else ctx.addIssue({ code: 'custom', path: ['visuals', i, 'id'], message: `Duplicate visual id "${visual.id}" (first used by visuals[${first}])` });
    });
  });

export type Manifest = z.output<typeof ManifestSchema>;
export type ManifestInput = z.input<typeof ManifestSchema>;
export type ManifestVisual = Manifest['visuals'][number];
export type ManifestComponentName = ManifestVisual['component'];
export type VisualOf<C extends ManifestComponentName> = Extract<ManifestVisual, { component: C }>;

/** Every component a manifest can name, in schema order. */
export const MANIFEST_COMPONENTS = Visual.options.map((o) => o.shape.component.value) as ManifestComponentName[];

/**
 * The element tag behind a component name: UniverusRankingBars → udp-pbi-ranking-bars. Manifest
 * names are the contract with Univerus-Lens; the elements follow UDP naming (udp-powerbi-visuals).
 */
export const elementTag = (name: ManifestComponentName): string =>
  `udp-pbi-${name.replace(/^Univerus/, '').replace(/[A-Z]/g, (c, i: number) => `${i ? '-' : ''}${c.toLowerCase()}`)}`;

export interface ManifestIssue {
  /** e.g. `visuals[2].grid.colSpan` */
  path: string;
  message: string;
}

export function formatIssuePath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((out, key) => (typeof key === 'number' ? `${out}[${key}]` : out ? `${out}.${String(key)}` : String(key)), '') || '(root)';
}

export type ManifestValidation = { ok: true; manifest: Manifest } | { ok: false; issues: ManifestIssue[] };

/** Parses a manifest (already JSON-parsed) and reports every problem with its path. */
export function validateManifest(input: unknown): ManifestValidation {
  const result = ManifestSchema.safeParse(input);
  if (result.success) return { ok: true, manifest: result.data };
  return { ok: false, issues: result.error.issues.map((i) => ({ path: formatIssuePath(i.path), message: i.message })) };
}

/** JSON text → validation (a syntax error is reported as an issue too). */
export function validateManifestText(text: string): ManifestValidation {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return { ok: false, issues: [{ path: '(root)', message: `Not valid JSON: ${error instanceof Error ? error.message : String(error)}` }] };
  }
  return validateManifest(json);
}

/** The JSON Schema Univerus-Lens validates against before handing a manifest over. */
export function manifestJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(ManifestSchema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
}
