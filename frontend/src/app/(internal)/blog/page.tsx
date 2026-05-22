'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Building2 } from 'lucide-react';
import { clientsApi, Client } from '@/lib/api/clients';

export default function BlogIndexPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    clientsApi.list({ limit: 200 }).then((r) => setClients(r.data)).finally(() => setLoading(false));
  }, []);

  const filtered = clients.filter((c) =>
    c.company_name.toLowerCase().includes(search.toLowerCase()) ||
    c.domain.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Blog</h1>
        <p className="text-sm text-gray-500 mt-0.5">Selecione o cliente para gerenciar os artigos</p>
      </div>

      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 text-center py-12">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-gray-400 text-center py-12">Nenhum cliente encontrado.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/blog/${c.id}/artigos`}
              className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-colors"
            >
              <div className="flex items-center justify-center w-9 h-9 bg-gray-100 rounded-lg">
                <Building2 size={16} className="text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{c.company_name}</p>
                <p className="text-xs text-gray-400 truncate">{c.domain}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
