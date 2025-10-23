import { MedusaConfigurationSchema } from '../schema/configuration.schema.js';

export function getMedusaTestConfiguration() {
  return MedusaConfigurationSchema.parse({
        publishable_key: process.env['MEDUSA_PUBLISHABLE_KEY'] || '',
        apiUrl: process.env['MEDUSA_API_URL'] || '',
    });
}

