'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { clientsApi, Client } from '@/lib/api/clients';
import dynamic from 'next/dynamic';

const GeoTab = dynamic(
  () => import('@/components/ui/geo-tab').then((m) => m.GeoTab),
  { loading: () => <div className="text-sm text-gray-400 py-8 text-center">Carregando IA Visibility...</div> },
);

export default function GeoClientPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    clientsApi.get(clientId)
      .then((res) => setClient(res.data))
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) return <div className="text-sm text-gray-400 py-16 text-center">Carregando...</div>;
  if (!client) return <div className="text-sm text-gray-500 py-16 text-center">Cliente não encontrado.</div>;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-5">
        <Link href="/geo" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{client.company_name}</h1>
          <p className="text-sm text-gray-500">{client.domain}</p>
        </div>
      </div>

      <GeoTab clientId={clientId} clientName={client.company_name} segment={client.market_segment?.name ?? client.segment?.name} />
    </div>
  );
}
