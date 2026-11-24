import { defaultListName, mdblistPublicUrl, parseMdblistUrl } from './client.js';

describe('parseMdblistUrl', () => {
  it('extracts username and slug from a list URL', () => {
    expect(
      parseMdblistUrl('https://mdblist.com/lists/linaspurinis/top-watched-movies'),
    ).toStrictEqual({ username: 'linaspurinis', slug: 'top-watched-movies' });
  });

  it('accepts www, trailing paths, query strings and a missing scheme', () => {
    const expected = { username: 'user', slug: 'my-list' };

    expect(parseMdblistUrl('https://www.mdblist.com/lists/user/my-list/')).toStrictEqual(expected);
    expect(parseMdblistUrl('https://mdblist.com/lists/user/my-list/json?x=1')).toStrictEqual(
      expected,
    );
    expect(parseMdblistUrl('mdblist.com/lists/user/my-list')).toStrictEqual(expected);
  });

  it.each([
    'https://example.com/lists/user/my-list',
    'https://mdblist.com.evil.test/lists/user/my-list',
    'https://mdblist.com/lists/user',
    'https://mdblist.com/movies/user/my-list',
    'https://mdblist.com/lists/user/../etc',
    'not a url',
  ])('rejects %s', (input) => {
    expect(() => parseMdblistUrl(input)).toThrow(/URL/u);
  });
});

describe('list naming helpers', () => {
  it('builds a readable default name from the slug', () => {
    expect(defaultListName({ username: 'u', slug: 'top-watched_movies' })).toBe(
      'Top Watched Movies',
    );
  });

  it('rebuilds the public URL from validated segments', () => {
    expect(mdblistPublicUrl({ username: 'u', slug: 's' })).toBe('https://mdblist.com/lists/u/s');
  });
});
