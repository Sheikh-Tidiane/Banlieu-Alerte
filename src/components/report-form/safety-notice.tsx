import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmergencyButton } from '@/components/emergency/emergency-button';
import { translate } from '@/i18n';

/** Message de sécurité affiché avant le formulaire (EXG-31). */
export function SafetyNotice({ onContinue }: { onContinue: () => void }) {
  return (
    <section aria-labelledby="safety-title" className="space-y-5">
      <div className="rounded-card border-danger/40 bg-danger/5 space-y-4 border p-5">
        <div className="flex items-start gap-3">
          <ShieldAlert aria-hidden="true" className="text-danger mt-0.5 size-7 shrink-0" />
          <div>
            <h2
              id="safety-title"
              className="text-muted text-sm font-semibold tracking-wide uppercase"
            >
              {translate('safety.title')}
            </h2>
            <p className="font-heading text-xl font-bold">{translate('safety.message')}</p>
          </div>
        </div>
        <ul className="list-disc space-y-1 pl-5">
          <li>{translate('safety.points.water')}</li>
          <li>{translate('safety.points.electricity')}</li>
          <li>{translate('safety.points.distance')}</li>
        </ul>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" onClick={onContinue} className="sm:flex-1">
          {translate('safety.understood')}
        </Button>
        <EmergencyButton size="lg" />
      </div>
    </section>
  );
}
