import type {
  Cache,
  FeatureFlagFactory,
  FeatureFlagFactoryOutput,
  FeatureFlagFactoryWithOutput,
  FeatureFlagQueryGetFlags,
  RequestContext,
  Result,
} from '@reactionary/core';
import {
  FeatureFlagCapability,
  success,
} from '@reactionary/core';
import type { FakeConfiguration, FakeFeatureFlagDefinition } from '../schema/configuration.schema.js';
import type { FakeFeatureFlagFactory } from '../factories/feature-flag/feature-flag.factory.js';

export class FakeFeatureFlagCapability<
  TFactory extends FeatureFlagFactory = FakeFeatureFlagFactory,
> extends FeatureFlagCapability<FeatureFlagFactoryOutput<TFactory>> {
  protected config: FakeConfiguration;
  protected factory: FeatureFlagFactoryWithOutput<TFactory>;
  protected flagDefinitions: Map<string, FakeFeatureFlagDefinition>;

  constructor(
    config: FakeConfiguration,
    cache: Cache,
    context: RequestContext,
    factory: FeatureFlagFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
    this.flagDefinitions = new Map(config.featureFlags?.flags.map((f) => [f.key, f]) ?? []);
  }

  public override async getFlags(
    payload: FeatureFlagQueryGetFlags,
  ): Promise<Result<FeatureFlagFactoryOutput<TFactory>[]>> {
    const flags = payload.featureFlagIdentifiers.map((id) => {
      const raw = this.evaluateFlag(id.key);
      return this.factory.parseFeatureFlag(this.context, raw);
    });
    return success(flags);
  }

  private evaluateFlag(key: string) {
    const definition = this.flagDefinitions.get(key);

    if (!definition) {
      return {
        identifier: { key },
        type: 'boolean' as const,
        enabled: false,
      };
    }

    if (definition.type === 'boolean') {
      return {
        identifier: { key },
        type: 'boolean' as const,
        enabled: definition.enabled,
      };
    }

    return {
      identifier: { key },
      type: 'multivariate' as const,
      variants: definition.variants.map((name) => ({
        name,
        enabled: name === definition.enabledVariant,
      })),
    };
  }
}
