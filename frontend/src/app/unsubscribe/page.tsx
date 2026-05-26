'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { emailMarketingApi } from '@/lib/api/email-marketing';

function UnsubscribeForm() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') ?? '';
  const campaignParam = searchParams.get('campaign');

  const [email, setEmail] = useState(emailParam);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (emailParam) setEmail(emailParam);
  }, [emailParam]);

  const handleUnsubscribe = async () => {
    if (!email.trim()) return;
    setStatus('loading');
    try {
      await emailMarketingApi.publicUnsubscribe(
        email.trim(),
        campaignParam ? `Descadastro via link da campanha ${campaignParam}` : 'Descadastro via link do email',
      );
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 max-w-md w-full p-8 text-center">
        <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-5">
          {status === 'success' ? (
            <CheckCircle size={28} className="text-emerald-500" />
          ) : status === 'error' ? (
            <AlertCircle size={28} className="text-red-500" />
          ) : (
            <Mail size={28} className="text-gray-400" />
          )}
        </div>

        {status === 'success' ? (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Descadastro realizado</h1>
            <p className="text-sm text-gray-500">
              O email <span className="font-medium text-gray-700">{email}</span> foi removido da nossa lista.
              Você não receberá mais emails de marketing da nossa parte.
            </p>
            <p className="text-xs text-gray-400 mt-4">
              Caso tenha sido um engano, entre em contato com{' '}
              <a href="mailto:contato@qualitysmi.com.br" className="text-blue-600 hover:underline">
                contato@qualitysmi.com.br
              </a>
            </p>
          </>
        ) : status === 'error' ? (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Ocorreu um erro</h1>
            <p className="text-sm text-gray-500 mb-4">
              Não foi possível processar o descadastro. Tente novamente.
            </p>
            <button onClick={() => setStatus('idle')}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Tentar novamente
            </button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Descadastro de emails</h1>
            <p className="text-sm text-gray-500 mb-5">
              Ao confirmar, você deixará de receber emails de marketing enviados pela Quality SMI.
            </p>

            <div className="mb-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
            </div>

            <button
              onClick={handleUnsubscribe}
              disabled={status === 'loading' || !email.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {status === 'loading' ? (
                <><Loader2 size={14} className="animate-spin" />Processando…</>
              ) : (
                'Confirmar descadastro'
              )}
            </button>

            <p className="text-xs text-gray-400 mt-3">
              Você pode solicitar o recadastramento a qualquer momento entrando em contato conosco.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    }>
      <UnsubscribeForm />
    </Suspense>
  );
}
