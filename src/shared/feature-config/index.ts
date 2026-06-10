import { type UnitValue, combine, createEvent, createStore, sample } from 'effector';
import { persist } from 'effector-storage/local';
import { produce } from 'immer';

type Features = UnitValue<typeof $defaultFeatures>;

export const updateFeatureStatus = createEvent<[feature: string, status: boolean]>();
export const resetFeatureStatuses = createEvent();

export const $mutatedFeatures = createStore<Partial<Features>>({});
export const $defaultFeatures = createStore({
  dashboard: true,
});

export const $features = combine($defaultFeatures, $mutatedFeatures, (base, extend) => ({ ...base, ...extend }));

persist({
  key: 'browser_features_v1',
  store: $mutatedFeatures,
  sync: true,
});

sample({
  clock: updateFeatureStatus,
  source: { mutated: $mutatedFeatures, desired: $defaultFeatures },
  fn({ desired, mutated }, [key, value]) {
    return produce(mutated, draft => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const featureKey = key as keyof Features;

      if (key in desired) {
        if (desired[featureKey] === value) {
          delete draft[featureKey];
        } else {
          draft[featureKey] = value;
        }
      } else {
        delete draft[featureKey];
      }
    });
  },
  target: $mutatedFeatures,
});

sample({
  clock: resetFeatureStatuses,
  target: $mutatedFeatures.reinit,
});
