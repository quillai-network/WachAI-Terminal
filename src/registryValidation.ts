import Ajv, { type AnySchema, type ErrorObject, type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";

export const DEFAULT_REGISTRY_BASE_URL =
  "https://raw.githubusercontent.com/quillai-network/mandate-specs/main/spec";

type PrimitiveRegistry = {
  specVersion: string;
  primitives: Array<{
    kind: string;
    name: string;
    version: number;
    schemaPath: string;
    description?: string;
  }>;
};

type PrimitiveSchema = {
  kind: string;
  version: number;
  description?: string;
  payloadSchema: unknown;
};

const ajv = new Ajv({
  allErrors: true,
  // The registry schemas are simple; disable strict mode to avoid friction as schemas evolve.
  strict: false,
});
addFormats(ajv);

const registryCache = new Map<string, PrimitiveRegistry>();
const schemaCache = new Map<string, PrimitiveSchema>();
const validatorCache = new Map<string, ValidateFunction>();

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return (await res.json()) as T;
}

export async function fetchRegistry(baseUrl = DEFAULT_REGISTRY_BASE_URL) {
  const key = baseUrl;
  const cached = registryCache.get(key);
  if (cached) return cached;

  const url = `${baseUrl.replace(/\/+$/, "")}/primitives/registry.json`;
  const reg = await fetchJson<PrimitiveRegistry>(url);
  registryCache.set(key, reg);
  return reg;
}

export async function resolvePrimitive(kind: string, baseUrl = DEFAULT_REGISTRY_BASE_URL) {
  const reg = await fetchRegistry(baseUrl);
  const prim = reg.primitives.find((p) => p.kind === kind);
  if (!prim) {
    const available = reg.primitives.map((p) => p.kind).sort();
    throw new Error(
      `Unknown primitive kind "${kind}". Available: ${available.length ? available.join(", ") : "(none)"}`
    );
  }
  return prim;
}

export async function fetchPrimitiveSchema(kind: string, baseUrl = DEFAULT_REGISTRY_BASE_URL) {
  const prim = await resolvePrimitive(kind, baseUrl);
  const url = `${baseUrl.replace(/\/+$/, "")}/${prim.schemaPath.replace(/^\/+/, "")}`;

  const cacheKey = `${baseUrl}::${prim.schemaPath}`;
  const cached = schemaCache.get(cacheKey);
  if (cached) return cached;

  const schema = await fetchJson<PrimitiveSchema>(url);
  schemaCache.set(cacheKey, schema);
  return schema;
}

function formatAjvErrors(errors: ErrorObject[] | null | undefined) {
  if (!errors?.length) return "Unknown schema validation error";
  return errors
    .map((e) => {
      const where = e.instancePath ? `at ${e.instancePath}` : "at <root>";
      const msg = e.message ?? "is invalid";
      if (e.keyword === "additionalProperties" && (e.params as any)?.additionalProperty) {
        return `${where}: unexpected property ${(e.params as any).additionalProperty}`;
      }
      return `${where}: ${msg}`;
    })
    .join("\n");
}

export async function validatePayloadForKind(params: {
  kind: string;
  payload: unknown;
  baseUrl?: string;
}) {
  const baseUrl = params.baseUrl ?? DEFAULT_REGISTRY_BASE_URL;
  const schema = await fetchPrimitiveSchema(params.kind, baseUrl);

  const validatorKey = `${baseUrl}::${schema.kind}@${schema.version}`;
  let validate = validatorCache.get(validatorKey);
  if (!validate) {
    validate = ajv.compile(schema.payloadSchema as AnySchema);
    validatorCache.set(validatorKey, validate);
  }

  const ok = validate(params.payload);
  if (ok) return;

  throw new Error(
    `Payload does not match schema for ${schema.kind}:\n${formatAjvErrors(validate.errors)}`
  );
}


