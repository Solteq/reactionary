import { googleAnalytics } from './google-analytics';

describe('googleAnalytics', () => {
  it('should work', () => {
    expect(googleAnalytics()).toEqual('google-analytics');
  });
});
