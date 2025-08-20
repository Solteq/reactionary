# @reactionary/otel

Zero-configuration OpenTelemetry instrumentation for Reactionary framework. Automatically instruments tRPC routes and providers using standard OTEL environment variables.

## Features

- **Zero Configuration**: Auto-initializes on first use with standard OTEL env vars
- **Automatic tRPC Route Tracing**: All tRPC procedures automatically traced
- **Provider Instrumentation**: BaseProvider operations automatically instrumented
- **Standard Compliance**: Uses official OpenTelemetry environment variables
- **Multiple Exporters**: Console, OTLP/HTTP, or custom exporters
- **Metrics Collection**: Request counts, durations, errors automatically tracked
- **Lazy Initialization**: Only starts when actually used

## Installation

```bash
pnpm add @reactionary/otel
```

That's it! No initialization code needed.

## How It Works

The OTEL package automatically initializes itself on first use, reading configuration from standard OpenTelemetry environment variables. When your code first creates a span or metric, the SDK initializes with your environment configuration.

```typescript
// No imports or initialization needed!
// Just use your tRPC router or providers normally
import { createTRPCRouter } from '@reactionary/trpc';

const router = createTRPCRouter(client);
// ↑ Automatically instrumented when OTEL env vars are set
```

## Configuration

Use standard OpenTelemetry environment variables. No code changes needed.

### Standard Environment Variables

```bash
# Service identification
OTEL_SERVICE_NAME=my-service
OTEL_SERVICE_VERSION=1.0.0
DEPLOYMENT_ENVIRONMENT=production

# Traces exporter (console | otlp | otlp/http | none)
OTEL_TRACES_EXPORTER=otlp

# Metrics exporter (console | otlp | otlp/http | none)
OTEL_METRICS_EXPORTER=otlp

# OTLP endpoint and headers
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io
OTEL_EXPORTER_OTLP_HEADERS=x-honeycomb-team=your-api-key

# Or use specific endpoints
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://api.honeycomb.io/v1/traces
OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=https://api.honeycomb.io/v1/metrics

# Debug logging
OTEL_LOG_LEVEL=debug

# Metrics export interval (milliseconds)
OTEL_METRIC_EXPORT_INTERVAL=60000
```

See the [OpenTelemetry specification](https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/) for all available options.

## Exporters

### Console (Development)
```bash
OTEL_TRACES_EXPORTER=console
OTEL_METRICS_EXPORTER=console
```

### OTLP (Production)
Works with any OTLP-compatible backend:

```bash
OTEL_TRACES_EXPORTER=otlp
OTEL_METRICS_EXPORTER=otlp
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io
OTEL_EXPORTER_OTLP_HEADERS=x-honeycomb-team=your-api-key
```

### Disable
```bash
OTEL_TRACES_EXPORTER=none
OTEL_METRICS_EXPORTER=none
```

## Custom Instrumentation

### Manual Spans

Create custom spans for specific operations:

```typescript
import { withSpan, getTracer } from '@reactionary/otel';

// Using withSpan helper
const result = await withSpan('custom-operation', async (span) => {
  span.setAttribute('custom.attribute', 'value');
  // Your operation here
  return someAsyncOperation();
});

// Using tracer directly
const tracer = getTracer();
const span = tracer.startSpan('manual-span');
try {
  // Your operation
  span.setStatus({ code: SpanStatusCode.OK });
} catch (error) {
  span.recordException(error);
  span.setStatus({ code: SpanStatusCode.ERROR });
  throw error;
} finally {
  span.end();
}
```

### Provider Instrumentation

Providers are automatically instrumented when extending BaseProvider:

```typescript
import { BaseProvider } from '@reactionary/core';

class MyProvider extends BaseProvider {
  // Automatically traced when OTEL is initialized
  protected async fetch(queries, session) {
    // Your implementation
  }
  
  protected async process(mutations, session) {
    // Your implementation
  }
}
```

### Custom Metrics

Track custom business metrics:

```typescript
import { getMetrics } from '@reactionary/otel';

const metrics = getMetrics();

// Increment counter
metrics.requestCounter.add(1, {
  'endpoint': '/api/users',
  'method': 'GET'
});

// Record histogram
metrics.requestDuration.record(150, {
  'endpoint': '/api/users',
  'status': 'success'
});
```

## Examples

### Honeycomb

```bash
OTEL_SERVICE_NAME=my-service
OTEL_TRACES_EXPORTER=otlp
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io
OTEL_EXPORTER_OTLP_HEADERS=x-honeycomb-team=your-api-key
```

### Local Development

```bash
OTEL_SERVICE_NAME=my-service-dev
OTEL_TRACES_EXPORTER=console
OTEL_METRICS_EXPORTER=none  # Disable metrics in dev
```

### Docker Compose with Jaeger

```yaml
services:
  app:
    environment:
      - OTEL_EXPORTER_TYPE=otlp
      - OTEL_COLLECTOR_ENDPOINT=http://jaeger:4318
      - OTEL_SERVICE_NAME=my-service
      
  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"  # Jaeger UI
      - "4318:4318"    # OTLP HTTP
```

## Metrics Reference

The following metrics are automatically collected:

| Metric | Type | Description |
|--------|------|-------------|
| `reactionary.requests` | Counter | Total number of requests |
| `reactionary.request.duration` | Histogram | Request duration in milliseconds |
| `reactionary.requests.active` | UpDownCounter | Number of active requests |
| `reactionary.errors` | Counter | Total number of errors |
| `reactionary.provider.calls` | Counter | Total provider calls |
| `reactionary.provider.duration` | Histogram | Provider call duration |
| `reactionary.cache.hits` | Counter | Cache hit count |
| `reactionary.cache.misses` | Counter | Cache miss count |

## Best Practices

1. **Use Standard Variables**: Stick to OpenTelemetry standard environment variables
2. **Set Service Name**: Always set `OTEL_SERVICE_NAME` for service identification
3. **Environment-based Config**: Use different configs for dev/staging/production
4. **Add Context**: Use span attributes to add business context to traces
5. **Handle Errors**: Ensure spans are properly closed even on errors
6. **Sample Wisely**: Consider sampling strategies for high-volume services
7. **Monitor Performance**: Watch for overhead in high-throughput scenarios

## Troubleshooting

### Traces Not Appearing

1. Check OTEL is initialized before other components
2. Verify `OTEL_TRACE_ENABLED` is not set to `false`
3. Check exporter configuration and endpoint connectivity
4. Look for initialization errors in console

### Performance Impact

- Use sampling to reduce overhead
- Disable metrics if not needed
- Consider using batch exporters
- Increase export intervals for metrics

### Memory Usage

- Monitor span processor queue size
- Adjust batch size and timeout
- Consider using sampling for high-volume services