'use client';

import { Siren } from 'lucide-react';
import { useState } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { translate } from '@/i18n';
import { EmergencyNumbers } from './emergency-numbers';

/** Bouton Urgence : affiche d'abord les numéros officiels, avant tout signalement. */
export function EmergencyButton({
  size,
  className,
  fullWidth,
}: Pick<ButtonProps, 'size' | 'className' | 'fullWidth'>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="danger"
        size={size}
        fullWidth={fullWidth}
        className={className}
        onClick={() => setOpen(true)}
      >
        <Siren aria-hidden="true" />
        {translate('emergency.button')}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={translate('emergency.title')}>
        <EmergencyNumbers />
      </Dialog>
    </>
  );
}
