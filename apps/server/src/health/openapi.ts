/**
 * OpenAPI specification generation — Hono route at `/api/openapi.json`.
 *
 * Introspects the tRPC appRouter at runtime to generate an OpenAPI 3.0 document.
 * Uses Zod 4's built-in `toJSONSchema()` to convert input schemas to JSON Schema.
 *
 * - Queries are mapped to GET endpoints with query parameters
 * - Mutations are mapped to POST endpoints with JSON request bodies
 * - The spec auto-updates when tRPC routers are modified (Requirement 8.5)
 */

import { env } from "@doji/env/server";
import * as Sentry from "@sentry/node";
import { Hono } from "hono";
import { toJSONSchema } from "zod";
import { type AppRouter, appRouter } from "../routers/index";

interface OpenApiParameter {
  in: "query" | "path";
  name: string;
  required: boolean;
  schema: Record<string, unknown>;
}

interface OpenApiRequestBody {
  content: {
    "application/json": {
      schema: Record<string, unknown>;
    };
  };
  required: boolean;
}

interface OpenApiResponse {
  content?: {
    "application/json": {
      schema: Record<string, unknown>;
    };
  };
  description: string;
}

interface OpenApiOperation {
  operationId: string;
  parameters?: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
  responses: Record<string, OpenApiResponse>;
  summary: string;
  tags: string[];
}

interface OpenApiPathItem {
  get?: OpenApiOperation;
  post?: OpenApiOperation;
}

interface OpenApiDocument {
  info: {
    title: string;
    version: string;
    description?: string;
  };
  openapi: string;
  paths: Record<string, OpenApiPathItem>;
  servers: Array<{ url: string; description?: string }>;
}

/**
 * Safely convert a Zod schema to JSON Schema.
 * Returns undefined if conversion fails (e.g., unsupported schema types).
 */
function safeToJsonSchema(
  zodSchema: unknown
): Record<string, unknown> | undefined {
  try {
    if (
      !zodSchema ||
      typeof zodSchema !== "object" ||
      !("_zod" in (zodSchema as Record<string, unknown>))
    ) {
      return;
    }
    const result = toJSONSchema(
      zodSchema as Parameters<typeof toJSONSchema>[0]
    );
    const { $schema: _, ...rest } = result as Record<string, unknown>;
    return rest;
  } catch {
    return;
  }
}

/**
 * Extract the tag (namespace) from a dotted procedure name.
 * e.g., "events.list" → "events", "healthCheck" → "general"
 */
function extractTag(procedureName: string): string {
  const dotIndex = procedureName.indexOf(".");
  return dotIndex > 0 ? procedureName.slice(0, dotIndex) : "general";
}

/**
 * Build OpenAPI parameters from a JSON Schema object definition.
 * Used for GET (query) endpoints to flatten object properties into query params.
 */
function buildQueryParameters(
  jsonSchema: Record<string, unknown>
): OpenApiParameter[] {
  const properties = jsonSchema.properties as
    | Record<string, Record<string, unknown>>
    | undefined;
  const required = (jsonSchema.required as string[]) ?? [];

  if (!properties) {
    return [];
  }

  return Object.entries(properties).map(([name, schema]) => ({
    name,
    in: "query" as const,
    required: required.includes(name),
    schema,
  }));
}

/**
 * Build the base operation object shared by queries and mutations.
 */
function buildOperation(
  name: string,
  type: string,
  tag: string,
  outputJsonSchema: Record<string, unknown> | undefined
): OpenApiOperation {
  return {
    operationId: name,
    summary: `${type === "mutation" ? "Mutate" : "Query"}: ${name}`,
    tags: [tag],
    responses: {
      "200": {
        description: "Successful response",
        content: {
          "application/json": {
            schema: outputJsonSchema ?? {
              type: "object",
              description:
                "Response wrapped in tRPC envelope: { result: { data } }",
            },
          },
        },
      },
      "400": { description: "Bad request — invalid input" },
      "500": { description: "Internal server error" },
    },
  };
}

/**
 * Build a path item for a single tRPC procedure.
 */
function buildPathItem(
  name: string,
  type: string,
  inputJsonSchema: Record<string, unknown> | undefined,
  outputJsonSchema: Record<string, unknown> | undefined
): OpenApiPathItem {
  const tag = extractTag(name);
  const operation = buildOperation(name, type, tag, outputJsonSchema);
  const pathItem: OpenApiPathItem = {};

  if (type === "mutation") {
    if (inputJsonSchema) {
      operation.requestBody = {
        required: true,
        content: { "application/json": { schema: inputJsonSchema } },
      };
    }
    pathItem.post = operation;
  } else {
    if (inputJsonSchema && inputJsonSchema.type === "object") {
      operation.parameters = buildQueryParameters(inputJsonSchema);
    }
    pathItem.get = operation;
  }

  return pathItem;
}

/**
 * Generate an OpenAPI 3.0 document from a tRPC router.
 *
 * Introspects `router._def.procedures` to discover all procedures,
 * their types (query/mutation), and Zod input schemas.
 */
export function generateOpenApiDocument(
  router: AppRouter,
  options: {
    title: string;
    version: string;
    baseUrl: string;
    description?: string;
  }
): OpenApiDocument {
  const doc: OpenApiDocument = {
    openapi: "3.0.3",
    info: {
      title: options.title,
      version: options.version,
      ...(options.description ? { description: options.description } : {}),
    },
    servers: [{ url: options.baseUrl }],
    paths: {},
  };

  const routerDef = (router as unknown as Record<string, unknown>)._def as
    | Record<string, unknown>
    | undefined;
  const procedures = routerDef?.procedures as
    | Record<string, Record<string, unknown>>
    | undefined;

  if (!procedures) {
    return doc;
  }

  for (const [name, procedure] of Object.entries(procedures)) {
    const procDef = procedure?._def as Record<string, unknown> | undefined;
    if (!procDef) {
      continue;
    }

    const type = (procDef.type as string) ?? "query";
    const inputs = (procDef.inputs as unknown[]) ?? [];
    const output = procDef.output;

    const inputJsonSchema =
      inputs.length > 0 ? safeToJsonSchema(inputs[0]) : undefined;
    const outputJsonSchema = safeToJsonSchema(output);

    doc.paths[`/trpc/${name}`] = buildPathItem(
      name,
      type,
      inputJsonSchema,
      outputJsonSchema
    );
  }

  return doc;
}

/**
 * Hono app for the OpenAPI endpoint.
 * Mount with: `app.route("/api", openapiApp)`
 */
export const openapiApp = new Hono();

openapiApp.get("/openapi.json", (c) =>
  Sentry.startSpan(
    {
      op: "openapi.generate",
      name: "generate_openapi_spec",
      attributes: {
        "api.route": "/api/openapi.json",
        "api.method": "GET",
      },
    },
    (span) => {
      const startedAt = Date.now();
      const port = env.PORT || "3001";
      const baseUrl = `http://localhost:${port}`;

      const spec = generateOpenApiDocument(appRouter, {
        title: "Poly API",
        version: "1.0.0",
        baseUrl,
        description:
          "Polymarket prediction market API — auto-generated from tRPC router definitions",
      });

      span.setAttributes({
        "openapi.path_count": Object.keys(spec.paths).length,
        "openapi.version": spec.openapi,
        "openapi.server_count": spec.servers.length,
      });
      const durationMs = Date.now() - startedAt;
      Sentry.metrics.count("openapi_requests_total", 1, {
        attributes: { outcome: "ok" },
      });
      Sentry.metrics.distribution("openapi_generation_latency", durationMs, {
        unit: "millisecond",
        attributes: { outcome: "ok" },
      });
      Sentry.metrics.gauge(
        "openapi_path_count",
        Object.keys(spec.paths).length
      );

      return c.json(spec);
    }
  )
);
