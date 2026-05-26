import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { PERMISSION_KEY } from '../../../common/decorators/permission.decorator';
import { UserRole } from '../../users/enums/user-role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;
    if (user.role === UserRole.SUPER_ADMIN) return true;

    // Verificação primária: role do usuário
    if (required.includes(user.role)) return true;

    // Fallback: permissão explícita concedida via painel de usuários.
    // Se o controller declara @RequirePermission no nível da classe e o usuário
    // possui essa permissão no JWT, libera acesso mesmo sem o role exigido.
    const classPerms = this.reflector.get<string[]>(PERMISSION_KEY, context.getClass());
    if (classPerms?.length) {
      const userPerms: string[] = user.permissions ?? [];
      return classPerms.every((p) => userPerms.includes(p));
    }

    return false;
  }
}
