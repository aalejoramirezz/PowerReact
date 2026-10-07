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
  fields: z.strictObject({ category: ColumnRef, value: MeasureKey, comparison: MeasureKey.optional() }),
  props: z.strictObject({
    ...chartProps,
    seriesLabel: z.string().max(40).optional(),
    comparisonLabel: z.string().max(40).optional(),
    area: z.boolean().default(true),
    directLabels: z.boolean().default(true),
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
]);

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
