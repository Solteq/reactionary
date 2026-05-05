import type {
  Cache,
  MarketingProfileFactory,
  MarketingProfileFactoryOutput,
  MarketingProfileFactoryWithOutput,
  MarketingProfileQueryGetProfile,
  NotFoundError,
  RequestContext,
  Result,
} from '@reactionary/core';
import {
  MarketingProfileCapability,
  MarketingProfileQueryGetProfileSchema,
  MarketingProfileSchema,
  Reactionary,
  success,
} from '@reactionary/core';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import type { FakeMarketingProfileFactory } from '../factories/marketing-profile/marketing-profile.factory.js';
import { calcSeed } from '../utilities/seed.js';

const SEGMENTS = ['Big Spender', 'Tech Head', 'Newbie', 'Gift Giver'] as const;

const BLURBS = [
  'Loves hiking and outdoor gear but dislikes crowded malls and slow shipping times on weekend orders',
  'Enjoys premium coffee and artisan food products while avoiding mass-produced snacks and cheap packaging materials',
  'Passionate about smart home gadgets and wireless tech but frustrated by complicated setup processes and poor documentation',
  'Prefers sustainable and eco-friendly brands over fast fashion and tends to research products thoroughly before buying',
  'Avid reader who collects rare editions and dislikes digital-only content preferring tactile experiences with real pages',
  'Fitness enthusiast who tracks every metric and avoids sugary supplements preferring clean ingredients and minimal branding',
  'Enjoys cooking exotic cuisines at home and dislikes pre-packaged meal kits that lack authentic spices and herbs',
  'Tech-savvy parent who values educational toys and screen-free activities but dislikes overly gendered product marketing campaigns',
] as const;

export class FakeMarketingProfileCapability<
  TFactory extends MarketingProfileFactory = FakeMarketingProfileFactory,
> extends MarketingProfileCapability<MarketingProfileFactoryOutput<TFactory>> {
  protected config: FakeConfiguration;
  protected factory: MarketingProfileFactoryWithOutput<TFactory>;

  constructor(
    config: FakeConfiguration,
    cache: Cache,
    context: RequestContext,
    factory: MarketingProfileFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  @Reactionary({
    inputSchema: MarketingProfileQueryGetProfileSchema,
    outputSchema: MarketingProfileSchema,
  })
  public override async getMarketingProfile(
    payload: MarketingProfileQueryGetProfile,
  ): Promise<Result<MarketingProfileFactoryOutput<TFactory>, NotFoundError>> {
    const identity = payload.identity;

    if (identity.type === 'Registered') {
      const userId = identity.id.userId;
      const seed = calcSeed(userId);
      const profileKey = hashToHex(seed);

      // Pick 2-4 segments deterministically
      const segmentCount = 2 + (Math.abs(seed) % 3); // 2, 3 or 4
      const segments = pickDeterministic(SEGMENTS, segmentCount, seed);

      const blurbIdx = Math.abs(seed) % BLURBS.length;
      const blurb = BLURBS[blurbIdx];

      return success(this.factory.parseMarketingProfile(this.context, {
        identifier: { key: profileKey },
        segments,
        blurb,
      }));
    }

    // Anonymous / Guest — random UUID-style key, no segments
    const anonSeed = calcSeed(Date.now().toString() + Math.random().toString());
    const anonKey = hashToHex(anonSeed);

    return success(this.factory.parseMarketingProfile(this.context, {
      identifier: { key: anonKey },
      segments: [],
      blurb: '',
    }));
  }
}

function hashToHex(seed: number): string {
  const abs = Math.abs(seed) >>> 0;
  return abs.toString(16).padStart(8, '0');
}

function pickDeterministic<T>(items: readonly T[], count: number, seed: number): T[] {
  const picked: T[] = [];
  const available = [...items];
  let s = Math.abs(seed);

  for (let i = 0; i < count && available.length > 0; i++) {
    const idx = s % available.length;
    picked.push(available[idx]);
    available.splice(idx, 1);
    s = Math.abs(calcSeed(s.toString()));
  }

  return picked;
}
