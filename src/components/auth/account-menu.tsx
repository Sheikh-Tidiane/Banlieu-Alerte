'use client';

import { LayoutDashboard, LogIn, LogOut, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { translate } from '@/i18n';
import { cn } from '@/lib/utils/cn';

type Me = { name: string; role: string; isStaff: boolean } | null;

const linkClass =
  'min-h-touch rounded-control text-ink hover:bg-line/60 inline-flex items-center gap-2 px-3 font-medium [&_svg]:size-5';

/**
 * Zone « compte » de l'en-tête. Chargée côté client : les pages restent statiques (et donc
 * utilisables hors ligne) et aucune donnée de compte n'est mise en cache dans le HTML.
 */
export function AccountMenu() {
  const router = useRouter();
  const [me, setMe] = useState<Me | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/me', { signal: controller.signal, cache: 'no-store' })
      .then((response) => response.json() as Promise<{ data: Me }>)
      .then((body) => setMe(body.data))
      .catch(() => {
        if (!controller.signal.aborted) setMe(null);
      });
    return () => controller.abort();
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    setMe(null);
    router.push('/');
    router.refresh();
  }

  if (me === undefined)
    return <span className="min-h-touch inline-block w-10" aria-hidden="true" />;

  if (me === null) {
    return (
      <Link href="/connexion" className={linkClass}>
        <LogIn aria-hidden="true" />
        <span className="hidden sm:inline">{translate('auth.login')}</span>
        <span className="sr-only sm:hidden">{translate('auth.login')}</span>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Link
        href={me.isStaff ? '/back-office' : '/mon-espace'}
        className={cn(linkClass, 'max-w-[11rem]')}
        title={me.name}
      >
        {me.isStaff ? <LayoutDashboard aria-hidden="true" /> : <UserRound aria-hidden="true" />}
        <span className="hidden truncate lg:inline">{me.name}</span>
        <span className="sr-only lg:hidden">
          {translate(me.isStaff ? 'auth.backoffice' : 'auth.myAccount')}
        </span>
      </Link>
      <button
        type="button"
        onClick={logout}
        className={linkClass}
        aria-label={translate('auth.logout')}
      >
        <LogOut aria-hidden="true" />
      </button>
    </div>
  );
}
