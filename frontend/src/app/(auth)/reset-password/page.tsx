'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/lib/api/client';

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Za-z]/, 'Deve conter ao menos uma letra')
      .regex(/\d/, 'Deve conter ao menos um número'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'As senhas não coincidem',
    path: ['confirm'],
  });

type FormData = z.infer<typeof schema>;

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    if (!token) {
      setError('Link inválido — token ausente.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token, password: data.password });
      router.replace('/login?reset=ok');
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      const msg = Array.isArray(raw) ? raw.join(' ') : raw;
      setError(msg ?? 'Não foi possível redefinir a senha. O link pode ter expirado.');
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
            <p className="text-xs text-gray-400 mt-2 tracking-wide">Definir nova senha</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nova senha</label>
              <input
                {...register('password')}
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar senha</label>
              <input
                {...register('confirm')}
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.confirm && <p className="text-red-500 text-xs mt-1">{errors.confirm.message}</p>}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !token}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              {submitting ? 'Salvando...' : 'Definir senha'}
            </button>

            <div className="text-center pt-2">
              <Link href="/login" className="text-xs text-gray-500 hover:text-blue-600 transition-colors">
                Voltar ao login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div />}>
      <ResetPasswordInner />
    </Suspense>
  );
}
