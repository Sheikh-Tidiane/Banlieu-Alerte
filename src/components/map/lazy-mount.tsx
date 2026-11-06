'use client';

import { Map as MapIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { translate } from '@/i18n';

/**
 * Monte la carte à la demande (D-061). Petit écran : seulement sur appui du bouton, après le
 * résumé en mots (DESIGN §2.4) – économise les données mobiles et le premier affichage.
 * À partir de 768 px : automatiquement, à l'approche de la zone visible.
 */
export function LazyMount({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || visible) return;
    if (!window.matchMedia('(min-width: 768px)').matches) return;
    if (typeof IntersectionObserver === 'undefined') {
      const timer = setTimeout(() => setVisible(true), 0);
      return () => clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
      },
      { rootMargin: '150px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={ref} className="h-full w-full">
      {visible ? (
        children
      ) : (
        <div className="bg-surface grid h-full min-h-[24rem] w-full place-items-center p-6 text-center">
          <Button variant="outline" onClick={() => setVisible(true)}>
            <MapIcon aria-hidden="true" />
            {translate('map.showMap')}
          </Button>
        </div>
      )}
    </div>
  );
}
