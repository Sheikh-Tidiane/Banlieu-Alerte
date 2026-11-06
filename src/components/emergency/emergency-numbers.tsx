import { Phone } from 'lucide-react';
import { EMERGENCY_NUMBERS_SOURCE, emergencyNumbers, telHref } from '@/lib/emergency/numbers';
import { translate } from '@/i18n';

/** Liste des numéros d'urgence, avec liens d'appel (EXG-31). Fonctionne hors ligne. */
export function EmergencyNumbers() {
  return (
    <div className="space-y-4">
      <p className="font-medium">{translate('emergency.lead')}</p>
      <ul className="space-y-3">
        {emergencyNumbers.map((entry) => (
          <li key={entry.service} className="rounded-card border-line bg-surface border p-4">
            <p className="font-heading font-semibold">{entry.service}</p>
            <p className="text-muted text-sm">{entry.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {entry.numbers.map((number) => (
                <a
                  key={number}
                  href={telHref(number)}
                  className="min-h-touch rounded-control bg-danger text-danger-foreground font-heading inline-flex items-center gap-2 px-4 text-lg font-bold"
                  aria-label={`${translate('emergency.call')} ${number} – ${entry.service}`}
                >
                  <Phone aria-hidden="true" className="size-5" />
                  {number}
                </a>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-muted text-xs">
        {translate('emergency.source')} : {EMERGENCY_NUMBERS_SOURCE}
      </p>
    </div>
  );
}
