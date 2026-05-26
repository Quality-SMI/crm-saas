import { UserRole } from '../../users/enums/user-role.enum';

export enum Permission {
  // Módulos principais
  LEADS_ACCESS = 'leads_access',
  AGENDA_ACCESS = 'agenda_access',
  CLIENTS_ACCESS = 'clients_access',
  USER_MANAGEMENT_ACCESS = 'user_management_access',
  ADMIN_ACCESS = 'admin_access',

  // Features de marketing digital
  KEYWORDS_ACCESS = 'keywords_access',
  POSITIONING_ACCESS = 'positioning_access',
  GEO_ACCESS = 'geo_access',
  BLOG_ACCESS = 'blog_access',
  EMAIL_MARKETING_ACCESS = 'email_marketing_access',
  SCORES_ACCESS = 'scores_access',

  // Financeiro
  FINANCIAL_VISIBILITY = 'financial_visibility',
  CONTRACT_VISIBILITY = 'contract_visibility',
  BUDGET_VISIBILITY = 'budget_visibility',

  // Analytics
  AI_VISIBILITY = 'ai_visibility',
  REPORTS_ACCESS = 'reports_access',
  ANALYTICS_ACCESS = 'analytics_access',
  EXPORT_PERMISSIONS = 'export_permissions',
}

export const ALL_PERMISSIONS = Object.values(Permission);

export const ROLE_PERMISSION_DEFAULTS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: ALL_PERMISSIONS,
  [UserRole.DIRECTOR]: ALL_PERMISSIONS,
  [UserRole.MANAGER]: [
    Permission.LEADS_ACCESS,
    Permission.AGENDA_ACCESS,
    Permission.CLIENTS_ACCESS,
    Permission.KEYWORDS_ACCESS,
    Permission.POSITIONING_ACCESS,
    Permission.GEO_ACCESS,
    Permission.BLOG_ACCESS,
    Permission.EMAIL_MARKETING_ACCESS,
    Permission.SCORES_ACCESS,
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
    Permission.KEYWORDS_ACCESS,
    Permission.POSITIONING_ACCESS,
    Permission.GEO_ACCESS,
    Permission.BLOG_ACCESS,
    Permission.SCORES_ACCESS,
    Permission.ANALYTICS_ACCESS,
    Permission.REPORTS_ACCESS,
  ],
  [UserRole.WRITER]: [
    Permission.CLIENTS_ACCESS,
    Permission.BLOG_ACCESS,
    Permission.KEYWORDS_ACCESS,
  ],
  [UserRole.SALES]: [
    Permission.LEADS_ACCESS,
    Permission.AGENDA_ACCESS,
    Permission.CLIENTS_ACCESS,
    Permission.SCORES_ACCESS,
  ],
  [UserRole.CLIENT_PORTAL]: [],
};
