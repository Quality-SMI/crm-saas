'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Search, CheckCircle, BarChart2, Link } from 'lucide-react';
import { positioningApi } from '@/lib/api/positioning';
import { Tooltip } from '@/components/ui/tooltip';

export default function IntegrationsPage() {
  const [status, setStatus] = useState<{ total: number; gscLinked: number; ga4Linked: number; unlinked: number } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [lastAction, setLastAction] = useState('');

  const loadStatus = () => {
    positioningApi.discoveryStatus().then(setStatus).catch(() => {});
  };

  useEffect(() => { loadStatus(); }, []);

  const handleSyncAll = async () => {
    setSyncing(true);
    setLastAction('');
    try {
      await positioningApi.syncAll();
      setLastAction('Sincronização disparada para todos os clientes vinculados.');
      loadStatus();
    } catch {
      setLastAction('Erro ao sincronizar.');
    } finally {
      setSyncing(false);
    }
  };

  const handleDiscovery = async () => {
    setDiscovering(true);
    setLastAction('');
    try {
      const res = await positioningApi.runDiscovery();
      setLastAction(`Discovery concluído: ${res.gscMatched} clientes vinculados ao Search Console.`);
      loadStatus();
    } catch {
      setLastAction('Erro no discovery.');
    } finally {
      setDiscovering(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Integrações</h1>
      <p className="text-sm text-gray-500 mb-6">Gerencie as conexões com serviços externos</p>

      {/* Google Search Console */}
      <div className="bg-white border border-gray-100 rounded-xl p-6 mb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Search size={18} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Google Search Console</h2>
              <p className="text-xs text-gray-500 mt-0.5">Posicionamento e keywords dos clientes</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
            <CheckCircle size={12} /> Conectado
          </span>
        </div>

        {status && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-900">{status.total}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total de clientes</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{status.gscLinked}</p>
              <p className="text-xs text-gray-500 mt-0.5">Vinculados ao GSC</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-orange-600">{status.unlinked}</p>
              <p className="text-xs text-gray-500 mt-0.5">Sem vínculo</p>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 mb-4">
          Sync automático: todo dia 1 e 15 de cada mês às 3h. Conta: qualitysmi@gmail.com
        </p>

        <div className="flex gap-2">
          <Tooltip text="Reescanear todos os sites do Search Console e re-vincular clientes por domínio">
            <button
              onClick={handleDiscovery}
              disabled={discovering || syncing}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <Link size={13} className={discovering ? 'animate-pulse' : ''} />
              {discovering ? 'Descobrindo...' : 'Re-vincular clientes'}
            </button>
          </Tooltip>

          <Tooltip text="Buscar dados de posicionamento agora para todos os clientes vinculados">
            <button
              onClick={handleSyncAll}
              disabled={syncing || discovering}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Sincronizando...' : 'Sincronizar todos agora'}
            </button>
          </Tooltip>
        </div>

        {lastAction && (
          <p className="text-xs text-blue-600 mt-3">{lastAction}</p>
        )}
      </div>

      {/* Google Analytics 4 */}
      <div className="bg-white border border-gray-100 rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
              <BarChart2 size={18} className="text-orange-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Google Analytics 4</h2>
              <p className="text-xs text-gray-500 mt-0.5">Sessões e usuários orgânicos por cliente</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
            <CheckCircle size={12} /> Conectado
          </span>
        </div>

        {status && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-900">{status.total}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total de clientes</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{status.ga4Linked}</p>
              <p className="text-xs text-gray-500 mt-0.5">Vinculados ao GA4</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-orange-600">{status.unlinked}</p>
              <p className="text-xs text-gray-500 mt-0.5">Sem vínculo</p>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400">
          Vínculo automático por domínio. Sessões e usuários orgânicos exibidos na aba Posicionamento Google de cada cliente.
        </p>
      </div>
    </div>
  );
}
