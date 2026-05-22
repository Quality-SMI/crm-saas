'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, Users, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';
import { usersApi, AppUser, ROLE_LABELS } from '@/lib/api/users';
import { useAuthStore } from '@/stores/auth.store';
import { Tooltip } from '@/components/ui/tooltip';

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN:   'bg-purple-100 text-purple-700',
  DIRECTOR:      'bg-blue-100 text-blue-700',
  MANAGER:       'bg-cyan-100 text-cyan-700',
  FINANCIAL:     'bg-green-100 text-green-700',
  TECHNICAL:     'bg-orange-100 text-orange-700',
  WRITER:        'bg-yellow-100 text-yellow-700',
  SALES:         'bg-pink-100 text-pink-700',
  CLIENT_PORTAL: 'bg-gray-100 text-gray-600',
};

export default function UsersPage() {
  const router = useRouter();
  const { hasRole } = useAuthStore();
  const canManage = hasRole('SUPER_ADMIN', 'DIRECTOR');

  const [users, setUsers] = useState<AppUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersApi.list({ page, limit: 20, search: search || undefined });
      setUsers(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Usuários</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} usuários internos</p>
        </div>
        {canManage && (
          <Tooltip text="Criar um novo usuário no sistema">
            <Link href="/settings/users/new"
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Plus size={16} /> Novo usuário
            </Link>
          </Tooltip>
        )}
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por nome ou email..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Tooltip text="Buscar usuários pelo nome ou email">
            <button type="submit" className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 rounded-lg transition-colors">
              Buscar
            </button>
          </Tooltip>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Carregando...</div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Users size={32} className="mb-3 opacity-30" />
            <p className="text-sm">Nenhum usuário encontrado</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Nome</th>
                <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Email</th>
                <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Perfil</th>
                <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Status</th>
                <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Último acesso</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}
                  onClick={() => canManage && router.push(`/settings/users/${u.id}`)}
                  className={`border-b border-gray-50 transition-colors ${canManage ? 'hover:bg-gray-50 cursor-pointer' : ''}`}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
                        {u.name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{u.name}</p>
                        {u.role === 'SUPER_ADMIN' && (
                          <span className="flex items-center gap-0.5 text-xs text-purple-600">
                            <ShieldCheck size={11} /> Super Admin
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">{u.email}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs">
                    {u.last_login_at
                      ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(u.last_login_at))
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">Página {page} de {totalPages}</p>
            <div className="flex gap-1">
              <Tooltip text="Página anterior">
                <button disabled={page === 1} onClick={() => setPage(page - 1)}
                  className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronLeft size={16} />
                </button>
              </Tooltip>
              <Tooltip text="Próxima página">
                <button disabled={page === totalPages} onClick={() => setPage(page + 1)}
                  className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronRight size={16} />
                </button>
              </Tooltip>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
