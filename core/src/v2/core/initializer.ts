type SelectionFor<P extends object> = Partial<Record<keyof P, boolean>>;

type PickSelected<P extends object, S extends SelectionFor<P>> = {
  [K in keyof P as K extends keyof S
    ? S[K] extends true
      ? K
      : never
    : never]: P[K]
};

export function makeInitializer<const P extends Record<string, unknown>>(providers: P) {
  return function initialize<const S extends SelectionFor<P>>(selection: S): PickSelected<P, S> {
    const result: Partial<P> = {};

    for (const key in selection) {
      if (selection[key]) {
        const k = key as keyof P;
        result[k] = providers[k];
      }
    }

    return result as unknown as PickSelected<P, S>;
  };
}