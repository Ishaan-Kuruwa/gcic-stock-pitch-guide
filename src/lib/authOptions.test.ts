import { describe, expect, it } from 'vitest';
import { buildAuthOptions, GOOGLE_SCOPES, withoutImage, withoutTokens } from './authOptions';

const settings = {
  baseURL: 'https://guide.example.dev',
  secret: 'test-secret',
  googleClientId: 'id',
  googleClientSecret: 'shh',
};

const options = buildAuthOptions(settings, undefined);
const google = options.socialProviders.google;
const hooks = options.databaseHooks;

describe('buildAuthOptions', () => {
  it('uses Google only', () => {
    expect(Object.keys(options.socialProviders)).toEqual(['google']);
    expect('emailAndPassword' in options).toBe(false);
  });

  it('asks Google for exactly openid, email and profile', () => {
    expect(GOOGLE_SCOPES).toEqual(['openid', 'email', 'profile']);
    expect(google.disableDefaultScope).toBe(true);
    expect(google.scope).toEqual(['openid', 'email', 'profile']);
  });

  it('maps the Google profile without a picture', async () => {
    const mapped = await google.mapProfileToUser();
    expect(mapped).toEqual({ image: undefined });
  });

  it('trusts only the site origin', () => {
    expect(options.trustedOrigins).toEqual(['https://guide.example.dev']);
    expect(options.basePath).toBe('/api/auth');
  });

  it('local dev trusts localhost only', () => {
    const local = buildAuthOptions({ ...settings, baseURL: 'http://localhost:4321' }, undefined);
    expect(local.trustedOrigins).toEqual(['http://localhost:4321']);
  });
});

describe('database hooks', () => {
  const user = { id: 'u1', name: 'Ada', email: 'ada@example.com', image: 'https://pic' };
  const account = {
    id: 'a1',
    providerId: 'google',
    accountId: '123',
    userId: 'u1',
    accessToken: 'at',
    refreshToken: 'rt',
    idToken: 'jwt',
    scope: 'openid email profile',
  };

  it('drops the picture when a user is created or updated', async () => {
    const created = await hooks.user.create.before(user as never);
    const updated = await hooks.user.update.before({ image: 'https://pic' });
    expect(created).toEqual({ data: { ...user, image: null } });
    expect(updated).toEqual({ data: { image: null } });
  });

  it('drops Google tokens when an account is created or updated', async () => {
    const created = await hooks.account.create.before(account as never);
    expect(created).toEqual({
      data: { ...account, accessToken: null, refreshToken: null, idToken: null },
    });
    const updated = await hooks.account.update.before({ idToken: 'jwt', scope: 's' });
    expect(updated).toEqual({ data: { idToken: null, scope: 's' } });
  });
});

describe('withoutImage / withoutTokens', () => {
  it('do not change the input', () => {
    const user = { name: 'Ada', image: 'x' };
    const account = { accessToken: 'at' };
    withoutImage(user);
    withoutTokens(account);
    expect(user.image).toBe('x');
    expect(account.accessToken).toBe('at');
  });

  it('withoutTokens leaves out fields that were never there', () => {
    expect(withoutTokens({ scope: 's' })).toEqual({ scope: 's' });
  });
});
