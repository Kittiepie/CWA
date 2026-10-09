import { BoardElementEntity } from './entity/board-element.entity';

/**
 * Mirrors the field/type tables in `HTTP3/src/types.ts`. Duplicated rather
 * than shared as a package because the API and HTTP3 servers are separate
 * deployable Node projects with independent package.json/node_modules — if
 * an element type or its fields change, update both files.
 */
export const ELEMENT_TYPES = [
  'rectangle',
  'diamond',
  'ellipse',
  'line',
  'freedraw',
  'text',
  'image',
] as const;

export type ElementType = (typeof ELEMENT_TYPES)[number];

export const FIELDS_BY_TYPE: Record<ElementType, readonly string[]> = {
  rectangle: ['position', 'size', 'strokeColor', 'backgroundColor'],
  diamond: ['position', 'size', 'strokeColor', 'backgroundColor'],
  ellipse: ['position', 'size', 'strokeColor', 'backgroundColor'],
  line: ['points', 'strokeColor'],
  freedraw: ['points', 'strokeColor'],
  text: ['position', 'size', 'text', 'color', 'fontSize'],
  image: ['position', 'size', 'imageId'],
};

function isElementType(value: unknown): value is ElementType {
  return (
    typeof value === 'string' &&
    (ELEMENT_TYPES as readonly string[]).includes(value)
  );
}

/** Shape stored in the Redis hash for every `elementId:field` entry. */
interface StoredField {
  value: unknown;
  time: [number, string];
}

export interface ReconstructedElement {
  id: string;
  type: ElementType;
  deleted: boolean;
  data: Record<string, unknown>;
}

/**
 * Groups a `board:{roomId}` Redis hash (`{elementId}:{field} -> StoredField`
 * JSON strings) back into per-element rows, merging each element's fields
 * per its type. Elements missing a valid `__type` field are dropped — they
 * can't be reconstructed without knowing which fields are legal.
 */
export function reconstructElementsFromHash(
  hash: Record<string, string>,
): ReconstructedElement[] {
  const fieldsByElement = new Map<string, Map<string, unknown>>();

  for (const [key, raw] of Object.entries(hash)) {
    const separatorIndex = key.indexOf(':');
    if (separatorIndex === -1) continue;

    const elementId = key.slice(0, separatorIndex);
    const field = key.slice(separatorIndex + 1);

    let stored: StoredField;
    try {
      stored = JSON.parse(raw) as StoredField;
    } catch {
      continue;
    }

    let fields = fieldsByElement.get(elementId);
    if (!fields) {
      fields = new Map();
      fieldsByElement.set(elementId, fields);
    }
    fields.set(field, stored.value);
  }

  const elements: ReconstructedElement[] = [];

  for (const [id, fields] of fieldsByElement) {
    const type = fields.get('__type');
    if (!isElementType(type)) continue;

    const data: Record<string, unknown> = {};
    for (const field of FIELDS_BY_TYPE[type]) {
      if (fields.has(field)) data[field] = fields.get(field);
    }

    elements.push({
      id,
      type,
      deleted: fields.get('deleted') === true,
      data,
    });
  }

  return elements;
}

/**
 * Inverse of `reconstructElementsFromHash`: turns saved Postgres rows into
 * `board:{roomId}` hash fields, timestamped with the row's own `updatedAt`
 * so a live edit with a newer real timestamp still wins under the
 * field-level last-write-wins rule the WebTransport server applies.
 */
export function elementsToHashFields(
  elements: BoardElementEntity[],
): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const element of elements) {
    if (!isElementType(element.type)) continue;

    const time: [number, string] = [
      element.updatedAt.getTime(),
      'postgres',
    ];

    const data = (element.data ?? {}) as Record<string, unknown>;
    for (const field of FIELDS_BY_TYPE[element.type]) {
      if (!(field in data)) continue;
      fields[`${element.id}:${field}`] = JSON.stringify({
        value: data[field],
        time,
      });
    }

    fields[`${element.id}:__type`] = JSON.stringify({
      value: element.type,
      time,
    });
    fields[`${element.id}:deleted`] = JSON.stringify({
      value: element.deleted,
      time,
    });
  }

  return fields;
}
