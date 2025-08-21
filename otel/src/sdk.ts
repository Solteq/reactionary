import { NodeSDK } from '@opentelemetry/sdk-node';

let sdk: NodeSDK | null = null;
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

// Detect if we're running in a browser environment
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof process === 'undefined';
}

// Auto-initialize OTEL on first use with standard env vars
function ensureInitialized(): void {
  if (isInitialized || initializationPromise) {
    return;
  }

  // Skip initialization in browser environments
  if (isBrowser()) {
    isInitialized = true;
    return;
  }

  // Prevent multiple initialization attempts
  initializationPromise = Promise.resolve().then(() => {
    // Let NodeSDK handle everything automatically via env vars
    // The SDK will automatically pick up OTEL_* environment variables
    sdk = new NodeSDK();

    sdk.start();
    isInitialized = true;

    process.on('SIGTERM', async () => {
      try {
        await shutdownOtel();
        if (process.env['OTEL_LOG_LEVEL'] === 'debug') {
          console.log('OpenTelemetry terminated successfully');
        }
      } catch (error) {
        console.error('Error terminating OpenTelemetry', error);
      }
    });
  });
}

export async function shutdownOtel(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
    isInitialized = false;
  }
}

export function isOtelInitialized(): boolean {
  ensureInitialized();
  return isInitialized;
}