'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { translate } from '@/i18n';

const MAX_LENGTH = 200;

/** Démonstration des composants interactifs de /design : champ validé, toast, modale. */
export function InteractiveDemo() {
  const toast = useToast();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string>();
  const [dialogOpen, setDialogOpen] = useState(false);

  function validate() {
    setError(value.length > MAX_LENGTH ? translate('design.fieldError') : undefined);
  }

  return (
    <div className="space-y-6">
      <Field label={translate('design.fieldLabel')} error={error}>
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            placeholder={translate('design.fieldPlaceholder')}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        )}
      </Field>
      <p className="text-muted text-sm" aria-live="polite">
        {value.length} / {MAX_LENGTH}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={validate}>
          {translate('design.validateField')}
        </Button>
        <Button variant="secondary" onClick={() => toast(translate('design.toastMessage'))}>
          {translate('design.showToast')}
        </Button>
        <Button variant="ghost" onClick={() => setDialogOpen(true)}>
          {translate('design.openDialog')}
        </Button>
      </div>
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={translate('design.dialogTitle')}
        footer={<Button onClick={() => setDialogOpen(false)}>{translate('common.close')}</Button>}
      >
        <p>{translate('design.dialogBody')}</p>
      </Dialog>
    </div>
  );
}
