import apiClient from './client';
import type { AxiosResponse } from 'axios';

export type UserRole =
  | 'SUPER_ADMIN' | 'DIRECTOR' | 'MANAGER'
  | 'FINANCIAL' | 'TECHNICAL' | 'WRITER' | 'SALES' | 'CLIENT_PORTAL';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  client_id: string | null;
  avatar_url: string | null;
  failed_login_attempts: number;
  locked_until: string | null;
  last_login_at: string | null;
  created_at: string;
}

export interface PaginatedUsers {
  data: AppUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UsersQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
}

export interface CreateUserBody {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserBody {
  name?: string;
  role?: UserRole;
  is_active?: boolean;
}

export interface UserPermissionsData {
  role_defaults: string[];
  overrides: { permission: string; granted: boolean }[];
  effective: string[];
}

export interface PermissionItem {
  code: string;
  label: string;
  description: string;
}

export interface PermissionGroup {
  id: string;
  label: string;
  permissions: PermissionItem[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'modules',
    label: 'Módulos Principais',
    permissions: [
      { code: 'clients_access', label: 'Clientes', description: 'Acesso ao módulo de clientes' },
      { code: 'leads_access', label: 'Leads', description: 'Acesso ao funil de vendas e prospecção' },
      { code: 'agenda_access', label: 'Agenda', description: 'Acesso à agenda e compromissos' },
      { code: 'user_management_access', label: 'Gestão de Usuários', description: 'Criar, editar e remover usuários do sistema' },
      { code: 'admin_access', label: 'Acesso Administrativo', description: 'Acesso a configurações administrativas do sistema' },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing Digital',
    permissions: [
      { code: 'keywords_access', label: 'Palavras-chave', description: 'Gerenciar keywords contratadas por cliente' },
      { code: 'positioning_access', label: 'Posicionamento Google', description: 'Acesso aos dados do Google Search Console e relatórios mensais' },
      { code: 'geo_access', label: 'GEO — Visibilidade em IAs', description: 'Acesso às análises de visibilidade em ChatGPT, Gemini e outras IAs' },
      { code: 'blog_access', label: 'Blog', description: 'Criar e editar artigos de blog por cliente' },
      { code: 'email_marketing_access', label: 'Email Marketing', description: 'Criar e disparar campanhas de email para leads e clientes' },
      { code: 'scores_access', label: 'Scores de Clientes', description: 'Visualizar score de saúde e engajamento dos clientes' },
    ],
  },
  {
    id: 'financial',
    label: 'Visibilidade Financeira',
    permissions: [
      { code: 'financial_visibility', label: 'Dados Financeiros', description: 'Visualizar valores financeiros dos clientes' },
      { code: 'contract_visibility', label: 'Contratos', description: 'Visualizar dados de contratos e serviços' },
      { code: 'budget_visibility', label: 'Orçamentos', description: 'Visualizar orçamentos e propostas comerciais' },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics & Relatórios',
    permissions: [
      { code: 'reports_access', label: 'Relatórios', description: 'Acesso a relatórios gerenciais e operacionais' },
      { code: 'analytics_access', label: 'Analytics', description: 'Acesso ao módulo de analytics e dashboards' },
      { code: 'ai_visibility', label: 'Central de IA', description: 'Acesso aos recursos de inteligência artificial' },
      { code: 'export_permissions', label: 'Exportação de Dados', description: 'Exportar dados em CSV, Excel e outros formatos' },
    ],
  },
];

export const usersApi = {
  list(params: UsersQuery = {}): Promise<PaginatedUsers> {
    return apiClient.get<PaginatedUsers>('/users', { params }).then((r: AxiosResponse<PaginatedUsers>) => r.data);
  },
  get(id: string): Promise<{ data: AppUser }> {
    return apiClient.get<{ data: AppUser }>(`/users/${id}`).then((r: AxiosResponse<{ data: AppUser }>) => r.data);
  },
  create(body: CreateUserBody): Promise<{ data: AppUser; message: string }> {
    return apiClient.post<{ data: AppUser; message: string }>('/users', body).then((r: AxiosResponse<{ data: AppUser; message: string }>) => r.data);
  },
  update(id: string, body: UpdateUserBody): Promise<{ data: AppUser; message: string }> {
    return apiClient.patch<{ data: AppUser; message: string }>(`/users/${id}`, body).then((r: AxiosResponse<{ data: AppUser; message: string }>) => r.data);
  },
  resetPassword(id: string, new_password: string): Promise<void> {
    return apiClient.post(`/users/${id}/reset-password`, { new_password }).then(() => undefined);
  },
  delete(id: string): Promise<void> {
    return apiClient.delete(`/users/${id}`).then(() => undefined);
  },
  getPermissions(id: string): Promise<{ data: UserPermissionsData }> {
    return apiClient.get<{ data: UserPermissionsData }>(`/users/${id}/permissions`).then((r: AxiosResponse<{ data: UserPermissionsData }>) => r.data);
  },
  setPermissions(id: string, permissions: Record<string, boolean>): Promise<{ message: string }> {
    return apiClient.put<{ message: string }>(`/users/${id}/permissions`, { permissions }).then((r: AxiosResponse<{ message: string }>) => r.data);
  },
};

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN:   'Super Admin',
  DIRECTOR:      'Diretor',
  MANAGER:       'Gerente',
  FINANCIAL:     'Financeiro',
  TECHNICAL:     'Técnico',
  WRITER:        'Redator',
  SALES:         'Comercial',
  CLIENT_PORTAL: 'Portal do Cliente',
};
