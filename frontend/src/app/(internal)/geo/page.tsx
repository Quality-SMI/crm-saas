'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, ChevronRight, Search, Sparkles, X, Bell } from 'lucide-react';
import { clientsApi, Client } from '@/lib/api/clients';
import { notificationsApi, Notification } from '@/lib/api/notifications';

interface CitedClient { id: string; name: string; mentions: number }

export default function GeoIndexPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    clientsApi.list({ limit: 200, status: 'ACTIVE' })
      .then((res) => setClients(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));

    notificationsApi.list()
      .then((all) => setNotifications(all.filter((n) => !n.is_read && n.type === 'GEO_CITATIONS')))
      .catch(() => {});
  }, []);

  const dismissNotification = (id: string) => {
    notificationsApi.markRead(id).catch(() => {});
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const filtered = clients.filter((c) =>
    c.company_name.toLowerCase().includes(search.toLowerCase()) ||
    c.domain?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
          <Bot size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">IA Visibility</h1>
          <p className="text-sm text-gray-500">Selecione um cliente para ver o monitoramento de visibilidade em IAs</p>
        </div>
      </div>

      {/* Notificações de menções não lidas */}
      {notifications.length > 0 && (
        <div className="mb-5 space-y-2">
          {notifications.map((notif) => {
            const meta = notif.metadata as { cited_clients?: CitedClient[] } | null;
            const citedClients: CitedClient[] = Array.isArray(meta?.cited_clients)
              ? (meta!.cited_clients as CitedClient[])
              : [];
            return (
              <div key={notif.id} className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Bell size={15} className="text-blue-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-blue-800">{notif.title}</p>
                    <p className="text-xs text-blue-600 mt-0.5">
                      {new Date(notif.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {citedClients.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {citedClients.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => { dismissNotification(notif.id); router.push(`/geo/${c.id}`); }}
                            className="flex items-center gap-1 px-2.5 py-1 bg-white border border-blue-200 rounded-lg text-xs text-blue-700 font-medium hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors"
                          >
                            <Sparkles size={10} />
                            {c.name}
                            <span className="text-blue-400 font-normal">({c.mentions})</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-blue-700 mt-1">{notif.body}</p>
                    )}
                  </div>
                  <button
                    onClick={() => dismissNotification(notif.id)}
                    className="text-blue-400 hover:text-blue-600 transition-colors shrink-0"
                    title="Dispensar"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente..."
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 py-16 text-center">Carregando clientes...</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-gray-400 py-16 text-center">Nenhum cliente ativo encontrado.</div>
      ) : (
        <div className="space-y-1">
          {filtered.map((client) => (
            <button
              key={client.id}
              onClick={() => router.push(`/geo/${client.id}`)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/40 transition-all text-left group"
            >
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 flex-shrink-0 group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                {client.company_name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{client.company_name}</p>
                <p className="text-xs text-gray-400 truncate">{client.domain}</p>
              </div>
              <ChevronRight size={15} className="text-gray-300 group-hover:text-blue-400 flex-shrink-0 transition-colors" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
