export class NoRoleError extends Error {
  constructor() {
    super('User has no matching DRK QR role');
    this.name = 'NoRoleError';
  }
}

export type Role = 'user' | 'admin';

export interface RoleMappingConfig {
  adminGroups: string[];
  userGroups: string[];
}

const DEFAULT_ADMIN_GROUPS = ['drk-qr-admin'];
const DEFAULT_USER_GROUPS = ['drk-qr-user'];

function parseList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function roleMappingConfigFromEnv(): RoleMappingConfig {
  const admin = parseList(process.env.OIDC_ADMIN_GROUPS);
  const user = parseList(process.env.OIDC_USER_GROUPS);
  return {
    adminGroups: admin.length > 0 ? admin : DEFAULT_ADMIN_GROUPS,
    userGroups: user.length > 0 ? user : DEFAULT_USER_GROUPS
  };
}

export function mapRoleFromGroups(groups: unknown, config: RoleMappingConfig): Role {
  if (!Array.isArray(groups)) throw new NoRoleError();
  if (config.adminGroups.some((g) => groups.includes(g))) return 'admin';
  if (config.userGroups.some((g) => groups.includes(g))) return 'user';
  throw new NoRoleError();
}
