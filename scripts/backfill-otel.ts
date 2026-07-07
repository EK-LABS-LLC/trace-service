if (!process.env.PULSE_MODE) {
  process.env.PULSE_MODE = "single";
}

const mode = process.env.PULSE_MODE;
const { initializeRuntimeServices } = await import("../runtime/services");

const services =
  mode === "scale"
    ? (await import("../runtime/modes/scale")).createScaleRuntimeServices()
    : (await import("../runtime/modes/single")).createSingleRuntimeServices();

initializeRuntimeServices(services);
await services.bootstrapDb();

const { legacyTraceToOtelSpan, toOtelTraceId } = await import("../services/otel");

const batchSize = Math.max(Number(process.env.OTEL_BACKFILL_BATCH_SIZE ?? 500), 1);
let offset = 0;
let scanned = 0;
let converted = 0;
let alreadySummarized = 0;

try {
  const { traces } = services.schema;

  for (;;) {
    const rows = await services.db
      .select()
      .from(traces)
      .limit(batchSize)
      .offset(offset);

    if (rows.length === 0) break;

    for (const trace of rows as any[]) {
      scanned += 1;
      const otelTraceId = toOtelTraceId(trace.traceId);
      const existing = await services.storage.getTraceSummary(otelTraceId, trace.projectId);
      if (existing) {
        alreadySummarized += 1;
        continue;
      }

      await legacyTraceToOtelSpan(
        trace.projectId,
        {
          trace_id: trace.traceId,
          session_id: trace.sessionId ?? undefined,
          timestamp: new Date(trace.timestamp).toISOString(),
          provider: trace.provider,
          model_requested: trace.modelRequested,
          model_used: trace.modelUsed ?? undefined,
          provider_request_id: trace.providerRequestId ?? undefined,
          request_body: trace.requestBody,
          response_body: trace.responseBody,
          input_tokens: trace.inputTokens ?? undefined,
          output_tokens: trace.outputTokens ?? undefined,
          output_text: trace.outputText ?? undefined,
          finish_reason: trace.finishReason ?? undefined,
          status: trace.status,
          error: trace.error,
          latency_ms: trace.latencyMs,
          cost_cents: trace.costCents ?? undefined,
          metadata: trace.metadata,
        },
        services.storage,
      );
      converted += 1;
    }

    offset += rows.length;
  }

  console.log(
    JSON.stringify(
      {
        status: "ok",
        scanned,
        converted,
        alreadySummarized,
      },
      null,
      2,
    ),
  );
} finally {
  await services.closeDb();
}
