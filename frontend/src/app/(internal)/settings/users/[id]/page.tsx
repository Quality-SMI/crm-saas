'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ChevronLeft, Trash2, KeyRound, ShieldCheck, User as UserIcon,
  CheckCircle2, XCircle, Info,
} from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import {
  usersApi, AppUser, ROLE_LABELS, UserRole,
  PERMISSION_GROUPS, UserPermissionsData,
} from '@/lib/api/users';
import { useAuthStore } from '@/stores/auth.store';

const ROLES: UserRole[] = ['SUPER_ADMIN', 'DIRECTOR', 'MANAGER', 'FINANCIAL', 'TECHNICAL', 'WRITER', 'SALES'];

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  role: z.enum(['SUPER_ADMIN', 'DIRECTOR', 'MANAGER', 'FINANCIAL', 'TECHNICAL', 'WRITER', 'SALES', 'CLIENT_PORTAL'] as const),
  is_active: z.boolean(),
});

type FormData = z.infer<typeof schema>;
type Tab = 'dados' | 'permissoes';

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      } ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user: me } = useAuthStore();

  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('dados');

  // Dados tab state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  // Permissões tab state
  const [permsData, setPermsData] = useState<UserPermissionsData | null>(null);
  const [permsLoading, setPermsLoading] = useState(false);
  const [permToggles, setPermToggles] = useState<Record<string, boolean>>({});
  const [permSaving, setPermSaving] = useState(false);
  const [permError, setPermError] = useState('');
  const [permSuccess, setPermSuccess] = useState('');

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
  });

  useEffect(() => {
    usersApi.get(id).then((res) => {
      setUser(res.data);
      reset({ name: res.data.name, role: res.data.role, is_active: res.data.is_active });
    }).finally(() => setLoading(false));
  }, [id, reset]);

  const loadPermissions = useCallback(async () => {
    if (permsData) return;
    setPermsLoading(true);
    try {
      const res = await usersApi.getPermissions(id);
      setPermsData(res.data);
      const toggles: Record<string, boolean> = {};
      for (const group of PERMISSION_GROUPS) {
        for (const perm of group.permissions) {
          toggles[perm.code] = res.data.effective.includes(perm.code);
        }
      }
      setPermToggles(toggles);
    } catch {
      setPermError('Erro ao carregar permissões.');
    } finally {
      setPermsLoading(false);
    }
  }, [id, permsData]);

  useEffect(() => {
    if (activeTab === 'permissoes') {
      loadPermissions();
    }
  }, [activeTab, loadPermissions]);

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await usersApi.update(id, data);
      setUser(res.data);
      setPermsData(null); // invalidate permissions cache (role may have changed)
      setSuccess('Usuário atualizado com sucesso');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Erro ao atualizar.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 8) return;
    setResetting(true);
    try {
      await usersApi.resetPassword(id, newPassword);
      setShowReset(false);
      setNewPassword('');
      setSuccess('Senha redefinida com sucesso');
    } catch {
      setError('Erro ao redefinir senha.');
    } finally {
      setResetting(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    if (!confirm(`Excluir "${user.name}"?`)) return;
    try {
      await usersApi.delete(id);
      router.push('/settings/users');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Erro ao excluir.'));
    }
  };

  const handleSavePermissions = async () => {
    setPermSaving(true);
    setPermError('');
    setPermSuccess('');
    try {
      await usersApi.setPermissions(id, permToggles);
      setPermSuccess('Permissões salvas com sucesso');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setPermError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Erro ao salvar permissões.'));
    } finally {
      setPermSaving(false);
    }
  };

  const isRoleDefault = (code: string) => permsData?.role_defaults.includes(code) ?? false;
  const hasOverride = (code: string) => permsData?.overrides.some((o) => o.permission === code) ?? false;
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  if (loading) return <div className="text-sm text-gray-400 py-16 text-center">Carregando...</div>;
  if (!user) return <div className="text-sm text-gray-500 py-16 text-center">Usuário não encontrado.</div>;

  const isSelf = me?.id === user.id;
  const canManagePerms = me?.role === 'SUPER_ADMIN' || (me?.role === 'DIRECTOR' && user.role !== 'SUPER_ADMIN');

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Tooltip text="Voltar para a lista de usuários" position="right">
          <Link href="/settings/users" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ChevronLeft size={18} />
          </Link>
        </Tooltip>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{user.name}</h1>
            {isSelf && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">você</span>}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{user.email}</p>
        </div>
        {!isSelf && (
          <Tooltip text="Excluir este usuário do sistema">
            <button onClick={handleDelete}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors">
              <Trash2 size={15} /> Excluir
            </button>
          </Tooltip>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-100">
        {([
          { id: 'dados', label: 'Dados', icon: UserIcon, tip: 'Ver e editar dados do usuário' },
          { id: 'permissoes', label: 'Permissões', icon: ShieldCheck, tip: 'Gerenciar permissões de acesso deste usuário' },
        ] as const).map(({ id: tabId, label, icon: Icon, tip }) => (
          <Tooltip key={tabId} text={tip} position="bottom">
            <button
              onClick={() => setActiveTab(tabId)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tabId
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          </Tooltip>
        ))}
      </div>

      {/* ── TAB: DADOS ─────────────────────────────────────────────────────── */}
      {activeTab === 'dados' && (
        <div className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
          {success && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">{success}</div>}

          <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome completo</label>
              <input {...register('name')}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Perfil de acesso</label>
              <select {...register('role')} disabled={isSelf}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-60">
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <input {...register('is_active')} type="checkbox" id="is_active"
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <label htmlFor="is_active" className="text-sm text-gray-700">Usuário ativo</label>
            </div>

            <div className="pt-2 flex justify-end">
              <Tooltip text="Salvar as alterações do usuário">
                <button type="submit" disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors">
                  {isLoading ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </Tooltip>
            </div>
          </form>

          {/* Reset password */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Redefinir senha</p>
                <p className="text-xs text-gray-500 mt-0.5">Apenas SUPER_ADMIN pode redefinir</p>
              </div>
              <Tooltip text="Abrir formulário para redefinir a senha deste usuário">
                <button onClick={() => setShowReset(!showReset)}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
                  <KeyRound size={15} /> Redefinir
                </button>
              </Tooltip>
            </div>
            {showReset && (
              <div className="mt-3 flex gap-2">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nova senha (mín. 8 chars)"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Tooltip text="Confirmar nova senha (mínimo 8 caracteres)">
                  <button onClick={handleResetPassword} disabled={resetting || newPassword.length < 8}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors">
                    {resetting ? '...' : 'Salvar'}
                  </button>
                </Tooltip>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: PERMISSÕES ────────────────────────────────────────────────── */}
      {activeTab === 'permissoes' && (
        <div className="space-y-4">
          {/* Context banner */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
            <Info size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                Perfil base: <span className="font-bold">{ROLE_LABELS[user.role]}</span>
              </p>
              <p className="text-xs text-blue-700 mt-0.5">
                As permissões marcadas como padrão vêm do perfil. Você pode ativar ou desativar individualmente para este usuário.
                {isSuperAdmin && ' Super Admins têm acesso total e não podem ter permissões modificadas.'}
              </p>
            </div>
          </div>

          {permsLoading && (
            <div className="text-sm text-gray-400 py-8 text-center">Carregando permissões...</div>
          )}

          {!canManagePerms && !permsLoading && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
              Você não tem permissão para editar permissões deste usuário.
            </div>
          )}

          {permError && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{permError}</div>}
          {permSuccess && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">{permSuccess}</div>}

          {!permsLoading && permsData && (
            <>
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-50 bg-gray-50">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{group.label}</h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {group.permissions.map((perm) => {
                      const enabled = permToggles[perm.code] ?? false;
                      const isDefault = isRoleDefault(perm.code);
                      const override = hasOverride(perm.code);

                      return (
                        <div key={perm.code} className="flex items-center gap-4 px-5 py-3.5">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-gray-900">{perm.label}</span>
                              {isDefault && !override && (
                                <span className="inline-flex items-center gap-0.5 text-xs text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                  <CheckCircle2 size={10} /> padrão do perfil
                                </span>
                              )}
                              {!isDefault && !override && (
                                <span className="inline-flex items-center gap-0.5 text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">
                                  <XCircle size={10} /> não incluído
                                </span>
                              )}
                              {override && (
                                <span className="inline-flex items-center gap-0.5 text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full">
                                  personalizado
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">{perm.description}</p>
                          </div>
                          <Toggle
                            checked={enabled}
                            onChange={(v) => {
                              setPermToggles((prev) => ({ ...prev, [perm.code]: v }));
                              setPermSuccess('');
                            }}
                            disabled={!canManagePerms || isSuperAdmin}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {canManagePerms && !isSuperAdmin && (
                <div className="flex justify-end pt-2">
                  <Tooltip text="Salvar as permissões personalizadas deste usuário">
                    <button
                      onClick={handleSavePermissions}
                      disabled={permSaving}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors"
                    >
                      {permSaving ? 'Salvando...' : 'Salvar permissões'}
                    </button>
                  </Tooltip>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
