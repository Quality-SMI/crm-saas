import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPermission } from './entities/user-permission.entity';
import {
  Permission,
  ALL_PERMISSIONS,
  ROLE_PERMISSION_DEFAULTS,
} from './enums/permission.enum';
import { UserRole } from '../users/enums/user-role.enum';

export interface UserPermissionsResponse {
  role_defaults: string[];
  overrides: { permission: string; granted: boolean }[];
  effective: string[];
}

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(UserPermission)
    private readonly repo: Repository<UserPermission>,
  ) {}

  getRoleDefaults(role: UserRole): string[] {
    if (role === UserRole.SUPER_ADMIN) return [...ALL_PERMISSIONS];
    return (ROLE_PERMISSION_DEFAULTS[role] ?? []).map((p) => p as string);
  }

  async getEffectivePermissions(
    userId: string,
    role: UserRole,
  ): Promise<string[]> {
    if (role === UserRole.SUPER_ADMIN) return [...ALL_PERMISSIONS];

    const defaults = new Set<string>(this.getRoleDefaults(role));
    const overrides = await this.repo.find({ where: { user_id: userId } });

    for (const override of overrides) {
      if (override.granted) {
        defaults.add(override.permission);
      } else {
        defaults.delete(override.permission);
      }
    }
    return [...defaults];
  }

  async getUserPermissionsResponse(
    userId: string,
    role: UserRole,
  ): Promise<UserPermissionsResponse> {
    const roleDefaults = this.getRoleDefaults(role);
    const overrides = await this.repo.find({ where: { user_id: userId } });
    const effective = await this.getEffectivePermissions(userId, role);

    return {
      role_defaults: roleDefaults,
      overrides: overrides.map((o) => ({
        permission: o.permission,
        granted: o.granted,
      })),
      effective,
    };
  }

  async setUserPermissions(
    userId: string,
    role: UserRole,
    permissions: Record<string, boolean>,
  ): Promise<void> {
    const defaults = new Set<string>(this.getRoleDefaults(role));

    await this.repo.delete({ user_id: userId });

    const toSave: UserPermission[] = [];
    for (const [perm, granted] of Object.entries(permissions)) {
      if (!ALL_PERMISSIONS.includes(perm as Permission)) continue;
      const isDefault = defaults.has(perm);
      if (granted !== isDefault) {
        toSave.push(
          this.repo.create({ user_id: userId, permission: perm, granted }),
        );
      }
    }

    if (toSave.length > 0) {
      await this.repo.save(toSave);
    }
  }
}
