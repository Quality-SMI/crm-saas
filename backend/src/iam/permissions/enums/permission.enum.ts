import { UserRole } from '../../users/enums/user-role.enum';

export enum Permission {
  LEADS_ACCESS = 'leads_access',
  AGENDA_ACCESS = 'agenda_access',
  CLIENTS_ACCESS = 'clients_access',
  FINANCIAL_VISIBILITY = 'financial_visibility',
  AI_VISIBILITY = 'ai_visibility',
  REPORTS_ACCESS = 'reports_access',
  ANALYTICS_ACCESS = 'analytics_access',
  CONTRACT_VISIBILITY = 'contract_visibility',
  BUDGET_VISIBILITY = 'budget_visibility',
  EXPORT_PERMISSIONS = 'export_permissions',
  USER_MANAGEMENT_ACCESS = 'user_management_access',
  ADMIN_ACCESS = 'admin_access',
}

export const ALL_PERMISSIONS = Object.values(Permission);

export const ROLE_PERMISSION_DEFAULTS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: ALL_PERMISSIONS,
  [UserRole.DIRECTOR]: ALL_PERMISSIONS,
  [UserRole.MANAGER]: [
    Permission.LEADS_ACCESS,
    Permission.AGENDA_ACCESS,
    Permission.CLIENTS_ACCESS,
    Permission.FINANCIAL_VISIBILITY,
    Permission.REPORTS_ACCESS,
    Permission.ANALYTICS_ACCESS,
    Permission.CONTRACT_VISIBILITY,
    Permission.BUDGET_VISIBILITY,
    Permission.EXPORT_PERMISSIONS,
  ],
  [UserRole.FINANCIAL]: [
    Permission.CLIENTS_ACCESS,
    Permission.FINANCIAL_VISIBILITY,
    Permission.REPORTS_ACCESS,
    Permission.ANALYTICS_ACCESS,
    Permission.CONTRACT_VISIBILITY,
    Permission.BUDGET_VISIBILITY,
    Permission.EXPORT_PERMISSIONS,
  ],
  [UserRole.TECHNICAL]: [
    Permission.CLIENTS_ACCESS,
  ],
  [UserRole.WRITER]: [
    Permission.CLIENTS_ACCESS,
  ],
  [UserRole.SALES]: [
    Permission.LEADS_ACCESS,
    Permission.AGENDA_ACCESS,
    Permission.CLIENTS_ACCESS,
  ],
  [UserRole.CLIENT_PORTAL]: [],
};
