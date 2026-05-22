'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { ClientForm, ClientFormData } from '@/components/ui/client-form';
import { clientsApi, ClientBody } from '@/lib/api/clients';

export default function NewClientPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (data: ClientFormData) => {
    setIsLoading(true);
    setError('');
    try {
      const created = await clientsApi.create(data as ClientBody);
      router.push(`/clients/${created.data.id}?tab=palavras-chave`);
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      const msg = Array.isArray(raw) ? raw.join(' • ') : raw;
      setError(msg ?? 'Erro ao criar cliente. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/clients" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Novo cliente</h1>
          <p className="text-sm text-gray-500 mt-0.5">Preencha os dados para cadastrar</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <ClientForm onSubmit={handleSubmit} isLoading={isLoading} submitLabel="Criar cliente" />
    </div>
  );
}
