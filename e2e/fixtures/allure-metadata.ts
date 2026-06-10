import * as allure from 'allure-js-commons';

export const setupTestMetadata = async (feature: string, story: string): Promise<void> => {
  await allure.feature(feature);
  await allure.story(story);
};

/**
 * Adds platform as an Allure parameter so tests from different OS runners
 * appear as separate results within the same launch.
 */
export const setupPlatformParameter = async (): Promise<void> => {
  const platform = process.env['RUNNER_OS'] ?? process.platform;
  await allure.parameter('Platform', platform);
};
