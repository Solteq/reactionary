export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { NodeSDK } = await import('@opentelemetry/sdk-node');

    const sdk = new NodeSDK();
    
    sdk.start();
  }
}
