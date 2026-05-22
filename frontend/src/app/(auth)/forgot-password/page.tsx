'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/lib/api/client';

const schema = z.object({
  email: z.string().email('Email inválido'),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setError('');
    setSubmitting(true);
    try {
      await api.post('/auth/forgot-password', { email: data.email });
      setDone(true);
    } catch {
      // Resposta neutra mesmo em erro — não vaza nada
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="flex flex-col items-center mb-8">
            <img src="/logo.png" alt="Quality SMI" className="h-14 w-auto object-contain" />
            <p className="text-xs text-gray-400 mt-2 tracking-wide">Recuperação de senha</p>
          </div>

          {done ? (
            <div className="text-center space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 text-sm">
                  Se este email estiver cadastrado, enviaremos instruções de recuperação
                  em alguns instantes. Verifique sua caixa de entrada e spam.
                </p>
              </div>
              <Link href="/login" className="text-blue-600 text-sm hover:underline inline-block">
                Voltar ao login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <p className="text-sm text-gray-600">
                Informe seu email cadastrado e enviaremos um link para criar uma nova senha.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
              >
                {submitting ? 'Enviando...' : 'Enviar link de recuperação'}
              </button>

              <div className="text-center pt-2">
                <Link href="/login" className="text-xs text-gray-500 hover:text-blue-600 transition-colors">
                  Voltar ao login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
