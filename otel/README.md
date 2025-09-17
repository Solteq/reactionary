# @reactionary/otel

OpenTelemetry instrumentation for the Reactionary framework. Provides decorators and utilities for tracing function execution and performance monitoring.

## Important: SDK Initialization Required

This library provides **instrumentation only**. The host application is responsible for initializing the OpenTelemetry SDK. Without proper SDK initialization, traces will be created as `NonRecordingSpan` instances with zero trace/span IDs.

## Features

- **Tracing Decorators**: Automatic span creation for decorated methods
- **Manual Instrumentation**: Utilities for custom tracing
- **Framework Integration**: Built-in support for tRPC and providers
- **Zero Dependencies**: Only requires OpenTelemetry API
- **Graceful Degradation**: Works without SDK initialization (produces no-op spans)

## Installation

```bash
pnpm add @reactionary/otel
```

**Important**: You must also install and configure the OpenTelemetry SDK in your host application.

## Usage

### Basic Tracing with Decorators

```typescript
import { traced } from '@reactionary/otel';

class MyService {
  @traced()
  async fetchData(id: string): Promise<Data> {
    // This method will be automatically traced
    return await dataSource.get(id);
  }

  @traced({ 
    spanName: 'custom-operation', 
    captureResult: false 
  })
  processData(data: Data): void {
    // Custom span name and no result capture
  }
}
```

### Manual Instrumentation

```typescript
import { withSpan, getTracer } from '@reactionary/otel';

// Using withSpan helper
const result = await withSpan('my-operation', async (span) => {
  span.setAttribute('operation.id', operationId);
  return await performOperation();
});

// Using tracer directly
const tracer = getTracer();
const span = tracer.startSpan('manual-span');
try {
  // Your code here
  span.setStatus({ code: SpanStatusCode.OK });
} catch (error) {
  span.setStatus({ code: SpanStatusCode.ERROR });
  span.recordException(error);
} finally {
  span.end();
}
```

## Setting Up OpenTelemetry SDK

### Next.js Applications

1. Create an `instrumentation.ts` file in your project root:

```typescript
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
    
    const sdk = new NodeSDK({
      instrumentations: [getNodeAutoInstrumentations()],
    });
    
    sdk.start();
  }
}
```

2. Enable instrumentation in `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
};

module.exports = nextConfig;
```

3. Configure environment variables:

```bash
# .env.local
OTEL_SERVICE_NAME=my-nextjs-app
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

### Node.js Applications

```typescript
// Initialize at the very beginning of your application
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

// Now import and use your application code
import './app';
```

### Environment Variables

The OpenTelemetry SDK can be configured using environment variables:

```bash
# Service identification
OTEL_SERVICE_NAME=my-app
OTEL_SERVICE_VERSION=1.0.0

# OTLP Exporter (for Jaeger, etc.)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf

# Console exporter (for development)
OTEL_TRACES_EXPORTER=console

# Sampling (optional)
OTEL_TRACES_SAMPLER=always_on

# Debug logging
OTEL_LOG_LEVEL=debug
```

## Troubleshooting

### ProxyTracer with NonRecordingSpan

If you see logs like:
```
tracer: ProxyTracer { _provider: ProxyTracerProvider {} }
ending span: NonRecordingSpan { _spanContext: { traceId: '00000000000000000000000000000000' } }
```

This means the OpenTelemetry SDK has not been initialized. Ensure you have:
1. Created an `instrumentation.ts` file (Next.js)
2. Initialized the SDK at application startup (Node.js)
3. Set the required environment variables

### Missing Traces

If the decorator is being applied but you don't see traces:
1. Verify the OTEL exporter is configured correctly
2. Check that your tracing backend is running
3. Ensure sampling is enabled (`OTEL_TRACES_SAMPLER=always_on`)

## API Reference

### Decorators

#### `@traced(options?)`

Decorates a method to automatically create spans for its execution.

**Options:**
- `captureArgs?: boolean` - Capture function arguments (default: true)
- `captureResult?: boolean` - Capture return value (default: true)
- `spanName?: string` - Custom span name (default: ClassName.methodName)
- `spanKind?: SpanKind` - OpenTelemetry span kind (default: INTERNAL)

### Utility Functions

- `getTracer(): Tracer` - Get the library's tracer instance
- `startSpan(name, options?, context?): Span` - Start a new span
- `withSpan<T>(name, fn, options?): Promise<T>` - Execute function within a span
- `setSpanAttributes(span, attributes): void` - Set multiple span attributes
- `createChildSpan(parent, name, options?): Span` - Create child span

### Constants

- `SpanKind` - OpenTelemetry span kinds
- `SpanStatusCode` - OpenTelemetry span status codes

## Examples

### Console Output (Development)
```bash
OTEL_SERVICE_NAME=my-service-dev
OTEL_TRACES_EXPORTER=console
```

### Jaeger (Local)
```bash
OTEL_SERVICE_NAME=my-service
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

### Honeycomb (Production)
```bash
OTEL_SERVICE_NAME=my-service
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io
OTEL_EXPORTER_OTLP_HEADERS=x-honeycomb-team=your-api-key
```