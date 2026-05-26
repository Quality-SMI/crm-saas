'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { notificationsApi } from '@/lib/api/notifications';
import { useAuthStore } from '@/stores/auth.store';
import { AuthGuard } from '@/components/auth-guard';
import {
  LayoutDashboard,
  Users,
  LogOut,
  ChevronRight,
  Building2,
  Settings,
  TrendingUp,
  CalendarDays,
  PanelLeftClose,
  PanelLeftOpen,
  Bot,
  Plug,
  PenLine,
  Mail,
} from 'lucide-react';

const GEO_ALLOWED_ROLES = ['SUPER_ADMIN', 'DIRECTOR', 'MANAGER', 'TECHNICAL', 'WRITER'];

const navMain = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clients', label: 'Clientes', icon: Building2 },
  { href: '/leads', label: 'Leads', icon: TrendingUp },
  { href: '/agenda', label: 'Agenda', icon: CalendarDays },
  { href: '/blog', label: 'Blog', icon: PenLine },
  { href: '/email-marketing', label: 'Email Marketing', icon: Mail },
];

const navIntelligence = [
  { href: '/geo', label: 'IA Visibility', icon: Bot, roles: GEO_ALLOWED_ROLES },
];

const SETTINGS_ALLOWED_ROLES = ['SUPER_ADMIN', 'DIRECTOR', 'MANAGER', 'FINANCIAL'];

const navSettings = [
  { href: '/settings/users', label: 'Usuários', icon: Users },
  { href: '/settings/integrations', label: 'Integrações', icon: Plug },
];

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [geoUnread, setGeoUnread] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored === 'true') setCollapsed(true);
  }, []);

  useEffect(() => {
    const fetchCount = () => {
      notificationsApi.unreadCount().then(setGeoUnread).catch(() => {});
    };
    fetchCount();
    intervalRef.current = setInterval(fetchCount, 5 * 60 * 1000); // recheck every 5min
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // Zera badge visual ao entrar em /geo (notificações marcadas individualmente ao clicar)
  useEffect(() => {
    if (pathname === '/geo' && geoUnread > 0) {
      setGeoUnread(0);
    }
  }, [pathname]);

  const toggle = () => {
    setCollapsed(prev => {
      localStorage.setItem('sidebar-collapsed', String(!prev));
      return !prev;
    });
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`bg-white border-r border-gray-100 flex flex-col transition-all duration-200 ease-in-out ${
          collapsed ? 'w-14' : 'w-56'
        }`}
      >
        {/* Logo + toggle */}
        <div className="h-14 flex items-center border-b border-gray-100">
          {collapsed ? (
            <div className="flex flex-col items-center w-full gap-1">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-white text-sm"
                style={{ background: 'linear-gradient(135deg, #1a2332 60%, #e36420 100%)' }}>
                Q
              </div>
              <button
                onClick={toggle}
                title="Expandir menu"
                className="flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <PanelLeftOpen size={13} />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center px-3 flex-1 min-w-0">
                <img src="/logo.png" alt="Quality SMI" className="h-8 w-auto object-contain" />
              </div>
              <button
                onClick={toggle}
                title="Recolher menu"
                className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0 mr-1"
              >
                <PanelLeftClose size={16} />
              </button>
            </>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {navMain.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link key={href} href={href}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  collapsed ? 'justify-center px-0' : ''
                } ${
                  active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon size={16} strokeWidth={active ? 2.5 : 2} className="flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span className="truncate">{label}</span>
                    {active && <ChevronRight size={12} className="ml-auto opacity-40 flex-shrink-0" />}
                  </>
                )}
              </Link>
            );
          })}

          {navIntelligence.filter(({ roles }) => roles.includes(user?.role ?? '')).length > 0 && (
            <>
              {!collapsed && (
                <div className="pt-4 pb-1">
                  <p className="px-3 text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Bot size={11} /> Inteligência
                  </p>
                </div>
              )}
              {collapsed && <div className="pt-3 pb-1 border-t border-gray-100 mx-1" />}
              {navIntelligence.filter(({ roles }) => roles.includes(user?.role ?? '')).map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + '/');
                const isGeo = href === '/geo';
                const badge = isGeo && geoUnread > 0 ? geoUnread : 0;
                return (
                  <Link key={href} href={href}
                    title={collapsed ? label : undefined}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                      collapsed ? 'justify-center px-0' : ''
                    } ${
                      active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <Icon size={16} strokeWidth={active ? 2.5 : 2} />
                      {badge > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                    </div>
                    {!collapsed && (
                      <>
                        <span className="truncate">{label}</span>
                        {badge > 0 && !active && (
                          <span className="ml-auto bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 flex-shrink-0">
                            {badge > 99 ? '99+' : badge}
                          </span>
                        )}
                        {active && badge === 0 && <ChevronRight size={12} className="ml-auto opacity-40 flex-shrink-0" />}
                      </>
                    )}
                  </Link>
                );
              })}
            </>
          )}

          {SETTINGS_ALLOWED_ROLES.includes(user?.role ?? '') && (
            <>
              {!collapsed && (
                <div className="pt-4 pb-1">
                  <p className="px-3 text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Settings size={11} /> Configurações
                  </p>
                </div>
              )}
              {collapsed && <div className="pt-4 pb-1 border-t border-gray-100 mx-1" />}

              {navSettings.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + '/');
                return (
                  <Link key={href} href={href}
                    title={collapsed ? label : undefined}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                      collapsed ? 'justify-center px-0' : ''
                    } ${
                      active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon size={16} strokeWidth={active ? 2.5 : 2} className="flex-shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="truncate">{label}</span>
                        {active && <ChevronRight size={12} className="ml-auto opacity-40 flex-shrink-0" />}
                      </>
                    )}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* User */}
        <div className="border-t border-gray-100 p-3">
          {!collapsed && (
            <div className="flex items-center gap-2 mb-2 px-2">
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">{user?.name?.split(' ')[0]}</p>
                <p className="text-xs text-gray-400 truncate">{user?.role}</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="flex justify-center mb-2">
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                {user?.name?.[0]?.toUpperCase()}
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            title={collapsed ? 'Sair' : undefined}
            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors ${
              collapsed ? 'justify-center px-0' : ''
            }`}
          >
            <LogOut size={13} className="flex-shrink-0" />
            {!collapsed && 'Sair'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 p-6 overflow-auto">
          <AuthGuard>{children}</AuthGuard>
        </div>
      </main>
    </div>
  );
}
