import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/page-shell';
import { MapExplorer } from '@/components/map/map-explorer';
import { StateBanner } from '@/components/ui/states';
import { translate } from '@/i18n';
import { listPublicNeighborhoods } from '@/services/geo/neighborhoods';

export const metadata: Metadata = { title: translate('map.title') };
export const dynamic = 'force-dynamic';

export default async function MapPage() {
  // La carte reste utilisable sans la liste des quartiers (filtre masqué).
  const neighborhoods = await listPublicNeighborhoods().catch(() => null);
  return (
    <PageShell className="max-w-6xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{translate('map.title')}</h1>
        <p className="text-muted max-w-2xl">{translate('map.lead')}</p>
      </div>
      {neighborhoods === null && <StateBanner kind="error" title={translate('map.error')} />}
      <MapExplorer neighborhoods={(neighborhoods ?? []).map(({ id, name }) => ({ id, name }))} />
    </PageShell>
  );
}
