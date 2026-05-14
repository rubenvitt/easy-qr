import { describe, it, expect, afterEach } from 'vitest';
import {
  mapRoleFromGroups,
  roleMappingConfigFromEnv,
  NoRoleError
} from '../../../src/lib/server/auth/role-mapping';

const defaults = { adminGroups: ['drk-qr-admin'], userGroups: ['drk-qr-user'] };

describe('mapRoleFromGroups', () => {
  it('admin wins over user', () => {
    expect(mapRoleFromGroups(['drk-qr-user', 'drk-qr-admin'], defaults)).toBe('admin');
  });
  it('maps drk-qr-user to user', () => {
    expect(mapRoleFromGroups(['drk-qr-user'], defaults)).toBe('user');
  });
  it('throws on empty', () => {
    expect(() => mapRoleFromGroups([], defaults)).toThrow(NoRoleError);
  });
  it('throws on unrelated groups', () => {
    expect(() => mapRoleFromGroups(['x'], defaults)).toThrow(NoRoleError);
  });
  it('throws on non-array', () => {
    expect(() => mapRoleFromGroups(undefined as unknown as string[], defaults)).toThrow(
      NoRoleError
    );
  });
  it('honors custom admin group names', () => {
    const cfg = { adminGroups: ['ops', 'super'], userGroups: ['member'] };
    expect(mapRoleFromGroups(['ops'], cfg)).toBe('admin');
    expect(mapRoleFromGroups(['super'], cfg)).toBe('admin');
    expect(mapRoleFromGroups(['member'], cfg)).toBe('user');
  });
  it('admin still wins when multiple lists overlap', () => {
    const cfg = { adminGroups: ['a1', 'a2'], userGroups: ['u1'] };
    expect(mapRoleFromGroups(['u1', 'a2'], cfg)).toBe('admin');
  });
});

describe('roleMappingConfigFromEnv', () => {
  const originalAdmin = process.env.OIDC_ADMIN_GROUPS;
  const originalUser = process.env.OIDC_USER_GROUPS;

  afterEach(() => {
    process.env.OIDC_ADMIN_GROUPS = originalAdmin;
    process.env.OIDC_USER_GROUPS = originalUser;
  });

  it('falls back to drk-qr-* defaults when env is unset', () => {
    delete process.env.OIDC_ADMIN_GROUPS;
    delete process.env.OIDC_USER_GROUPS;
    expect(roleMappingConfigFromEnv()).toEqual(defaults);
  });

  it('parses comma-separated lists and trims whitespace', () => {
    process.env.OIDC_ADMIN_GROUPS = 'ops, super-admins';
    process.env.OIDC_USER_GROUPS = ' members , staff ';
    expect(roleMappingConfigFromEnv()).toEqual({
      adminGroups: ['ops', 'super-admins'],
      userGroups: ['members', 'staff']
    });
  });

  it('ignores empty entries', () => {
    process.env.OIDC_ADMIN_GROUPS = 'a,,b,';
    process.env.OIDC_USER_GROUPS = ',';
    expect(roleMappingConfigFromEnv()).toEqual({
      adminGroups: ['a', 'b'],
      userGroups: ['drk-qr-user']
    });
  });
});
