'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { translate, type TranslationKey } from '@/i18n';
import { cn } from '@/lib/utils/cn';

type Item = { href: string; label: TranslationKey };

/** Navigation du back-office : seuls les liens autorisés au rôle sont passés en props. */
export function BackofficeNav({ items }: { items: Item[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label={translate('backoffice.title')} className="-mx-4 overflow-x-auto px-4">
      <ul className="border-line flex min-w-max gap-1 border-b">
        {items.map((item) => {
          const active =
            item.href === '/back-office' ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href as '/back-office'}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'min-h-touch -mb-px inline-flex items-center border-b-2 px-3 font-medium',
                  active
                    ? 'border-primary text-primary'
                    : 'text-muted hover:text-ink border-transparent',
                )}
              >
                {translate(item.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
