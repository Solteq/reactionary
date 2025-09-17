import { getTracer } from '../tracer';
describe('Otel Integration', () => {
    it('should initialize OpenTelemetry without errors', async () => {
      const tracer =  getTracer();

      expect(tracer).toBeDefined();
    });
});
