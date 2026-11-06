'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, CircleCheck, CloudOff, Map as MapIcon, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { loadLocationPicker } from '@/components/map/load-location-picker';
import { ReportTypeIcon } from '@/components/reports/report-type-icon';
import { Button, buttonVariants } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/field';
import { StateBanner } from '@/components/ui/states';
import type { LatLng } from '@/lib/geo/distance';
import { enqueueReport, submitReport } from '@/lib/offline/queue';
import { translate, type TranslationKey } from '@/i18n';
import { cn } from '@/lib/utils/cn';
import {
  DESCRIPTION_MAX,
  REPORT_TYPES,
  reportFormSchema,
  SEVERITIES,
  type ReportFormValues,
} from '@/validators/report';
import { LocationStep } from './location-step';
import { PhotoField } from './photo-field';
import { SafetyNotice } from './safety-notice';

type Step = 'safety' | 'type' | 'location' | 'details';
type Outcome =
  | { kind: 'sent'; trackingCode: string }
  | { kind: 'queued' }
  | { kind: 'duplicate'; duplicates: string[] }
  | { kind: 'error'; message: string };

const STEPS: Step[] = ['type', 'location', 'details'];

/** Parcours de signalement sans compte, en 3 étapes (CDC §4.1, EXG-01, EXG-02, EXG-04). */
export function ReportForm() {
  const [step, setStep] = useState<Step>('safety');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // Début de la saisie, fixé en quittant le message de sécurité (durée minimale, D-028).
  const startedAt = useRef<number | null>(null);
  const clientId = useRef<string | null>(null);

  // Précharge la carte de l'étape 2 : son code est ainsi en cache si le réseau tombe ensuite.
  // Le préchargement attend que le navigateur soit inactif, pour ne pas retarder l'affichage.
  useEffect(() => {
    const load = () => void loadLocationPicker();
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(load, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = globalThis.setTimeout(load, 2000);
    return () => globalThis.clearTimeout(timer);
  }, []);

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: { description: '' },
    mode: 'onSubmit',
  });
  const { register, setValue, trigger, handleSubmit, formState, control } = form;
  const values = useWatch({ control });
  const position: LatLng | null =
    typeof values.lat === 'number' && typeof values.lng === 'number'
      ? { lat: values.lat, lng: values.lng }
      : null;

  const setPosition = useCallback(
    (next: LatLng) => {
      setValue('lat', next.lat, { shouldValidate: false });
      setValue('lng', next.lng, { shouldValidate: false });
    },
    [setValue],
  );
  const setNeighborhood = useCallback(
    (id: string | undefined) => setValue('neighborhoodId', id),
    [setValue],
  );

  async function goNext() {
    if (step === 'type' && (await trigger('type'))) setStep('location');
    else if (step === 'location' && (await trigger(['lat', 'lng']))) setStep('details');
  }

  function goBack() {
    if (step === 'location') setStep('type');
    else if (step === 'details') setStep('location');
    else if (step === 'type') setStep('safety');
  }

  async function send(data: ReportFormValues, confirmNotDuplicate = false) {
    // Un même clientId pour tous les essais de ce signalement (idempotence, D-027).
    clientId.current ??= crypto.randomUUID();
    const fields: Record<string, string> = {
      clientId: clientId.current,
      type: String(data.type),
      severity: String(data.severity),
      lat: String(data.lat),
      lng: String(data.lng),
      fillDurationMs: String(Date.now() - (startedAt.current ?? Date.now())),
      website: '',
      confirmNotDuplicate: String(confirmNotDuplicate),
    };
    if (data.neighborhoodId) fields.neighborhoodId = data.neighborhoodId;
    if (data.description) fields.description = String(data.description);

    setSending(true);
    try {
      const result = navigator.onLine
        ? await submitReport(fields, photo ?? undefined)
        : ({ kind: 'network' } as const);
      if (result.kind === 'network') {
        await enqueueReport({ clientId: clientId.current, fields, photo: photo ?? undefined });
        setOutcome({ kind: 'queued' });
      } else if (result.kind === 'sent') {
        setOutcome({ kind: 'sent', trackingCode: result.trackingCode });
      } else if (result.kind === 'duplicate') {
        setOutcome({ kind: 'duplicate', duplicates: result.duplicates });
      } else if (result.kind === 'rate-limited') {
        setOutcome({ kind: 'error', message: translate('reportForm.rateLimited') });
      } else {
        setOutcome({ kind: 'error', message: result.message });
      }
    } finally {
      setSending(false);
    }
  }

  function restart() {
    form.reset({ description: '' });
    setPhoto(null);
    setOutcome(null);
    clientId.current = null;
    startedAt.current = Date.now();
    setStep('type');
  }

  if (outcome?.kind === 'sent') {
    return (
      <section aria-labelledby="done-title" className="space-y-5 text-center">
        <CircleCheck aria-hidden="true" className="text-safe mx-auto size-14" />
        <h2 id="done-title" className="text-2xl font-bold">
          {translate('reportForm.doneTitle')}
        </h2>
        <p>{translate('reportForm.doneLead')}</p>
        <div className="rounded-card border-primary bg-primary/5 mx-auto w-fit border-2 px-6 py-4">
          <p className="text-muted text-sm">{translate('reportForm.trackingCode')}</p>
          <p
            className="font-heading text-primary text-3xl font-bold tracking-wider"
            data-testid="tracking-code"
          >
            {outcome.trackingCode}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={`/signalements/${outcome.trackingCode}`}
            className={buttonVariants({ variant: 'primary' })}
          >
            {translate('reportForm.seeReport')}
          </Link>
          <Link href="/carte" className={buttonVariants({ variant: 'outline' })}>
            <MapIcon aria-hidden="true" />
            {translate('reportForm.seeMap')}
          </Link>
          <Button variant="ghost" onClick={restart}>
            {translate('reportForm.another')}
          </Button>
        </div>
      </section>
    );
  }

  if (outcome?.kind === 'queued') {
    return (
      <section aria-labelledby="queued-title" className="space-y-5 text-center">
        <CloudOff aria-hidden="true" className="text-water mx-auto size-14" />
        <h2 id="queued-title" className="text-2xl font-bold">
          {translate('reportForm.queuedTitle')}
        </h2>
        <p>{translate('reportForm.queuedLead')}</p>
        <Button variant="outline" onClick={restart}>
          {translate('reportForm.another')}
        </Button>
      </section>
    );
  }

  if (outcome?.kind === 'duplicate') {
    return (
      <section aria-labelledby="duplicate-title" className="space-y-5">
        <TriangleAlert aria-hidden="true" className="text-warning size-12" />
        <h2 id="duplicate-title" className="text-2xl font-bold">
          {translate('reportForm.duplicateTitle')}
        </h2>
        <p>{translate('reportForm.duplicateLead')}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          {outcome.duplicates[0] && (
            <Link
              href={`/signalements/${outcome.duplicates[0]}`}
              className={buttonVariants({ variant: 'primary' })}
            >
              {translate('reportForm.duplicateSee')}
            </Link>
          )}
          <Button
            variant="outline"
            disabled={sending}
            onClick={() => void handleSubmit((data) => send(data, true))()}
          >
            {translate('reportForm.duplicateDifferent')}
          </Button>
        </div>
      </section>
    );
  }

  if (step === 'safety') {
    return (
      <SafetyNotice
        onContinue={() => {
          startedAt.current = Date.now();
          setStep('type');
        }}
      />
    );
  }

  const index = STEPS.indexOf(step) + 1;
  const titles: Record<Exclude<Step, 'safety'>, TranslationKey> = {
    type: 'reportForm.typeTitle',
    location: 'reportForm.locationTitle',
    details: 'reportForm.detailsTitle',
  };

  return (
    <form
      noValidate
      onSubmit={(event) => void handleSubmit((data) => send(data))(event)}
      className="space-y-6"
    >
      {/* Champ piège anti-robot (D-028) : invisible et ignoré par les lecteurs d'écran. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <div className="space-y-2">
        <p className="text-muted text-sm font-semibold">
          {translate('reportForm.stepOf')} {index} {translate('reportForm.of')} {STEPS.length}
        </p>
        <div className="flex gap-2" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={cn('rounded-pill h-1.5 flex-1', i < index ? 'bg-primary' : 'bg-line')}
            />
          ))}
        </div>
        <h2 className="text-2xl font-bold">{translate(titles[step])}</h2>
      </div>

      {step === 'type' && (
        <fieldset className="space-y-3">
          <legend className="sr-only">{translate('reportForm.typeTitle')}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {REPORT_TYPES.map((type) => {
              const selected = values.type === type;
              return (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setValue('type', type, { shouldValidate: true });
                    setStep('location');
                  }}
                  className={cn(
                    'rounded-card flex min-h-20 items-center gap-4 border-2 p-4 text-left transition-colors',
                    selected
                      ? 'border-primary bg-primary/10'
                      : 'border-line bg-surface-raised hover:border-primary',
                  )}
                >
                  <span className="bg-water/10 text-water rounded-pill grid size-12 shrink-0 place-items-center">
                    <ReportTypeIcon type={type} className="size-6" />
                  </span>
                  <span>
                    <span className="font-heading block text-lg font-semibold">
                      {translate(`reportType.${type}`)}
                    </span>
                    <span className="text-muted block text-sm">
                      {translate(`reportTypeHint.${type}`)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {formState.errors.type && (
            <p role="alert" className="text-danger text-sm font-medium">
              {formState.errors.type.message}
            </p>
          )}
        </fieldset>
      )}

      {step === 'location' && (
        <div className="space-y-6">
          <LocationStep
            position={position}
            onPositionChange={setPosition}
            neighborhoodId={values.neighborhoodId}
            onNeighborhoodChange={setNeighborhood}
            error={
              formState.errors.lat?.message || formState.errors.lng?.message
                ? (formState.errors.lat?.message ?? formState.errors.lng?.message)
                : undefined
            }
          />
          <PhotoField value={photo} onChange={setPhoto} />
        </div>
      )}

      {step === 'details' && (
        <div className="space-y-6">
          <fieldset className="space-y-3">
            <legend className="font-medium">{translate('reportForm.severityLabel')}</legend>
            <div className="grid gap-3 sm:grid-cols-3" role="radiogroup">
              {SEVERITIES.map((severity) => {
                const selected = values.severity === severity;
                return (
                  <button
                    key={severity}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setValue('severity', severity, { shouldValidate: true })}
                    className={cn(
                      'rounded-card min-h-touch border-2 p-4 text-left',
                      selected
                        ? 'border-primary bg-primary/10'
                        : 'border-line bg-surface-raised hover:border-primary',
                    )}
                  >
                    <span className="font-heading block font-semibold">
                      {translate(`severity.${severity}`)}
                    </span>
                    <span className="text-muted block text-sm">
                      {translate(`severityHint.${severity}`)}
                    </span>
                  </button>
                );
              })}
            </div>
            {formState.errors.severity && (
              <p role="alert" className="text-danger text-sm font-medium">
                {formState.errors.severity.message}
              </p>
            )}
          </fieldset>

          <Field
            label={translate('reportForm.descriptionLabel')}
            hint={`${DESCRIPTION_MAX} caractères maximum.`}
            error={formState.errors.description?.message}
          >
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                maxLength={DESCRIPTION_MAX}
                placeholder={translate('reportForm.descriptionPlaceholder')}
                {...register('description')}
              />
            )}
          </Field>

          {outcome?.kind === 'error' && (
            <StateBanner
              kind="error"
              title={translate('reportForm.errorTitle')}
              body={outcome.message}
            />
          )}
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button variant="ghost" onClick={goBack}>
          <ArrowLeft aria-hidden="true" />
          {translate('reportForm.back')}
        </Button>
        {step === 'details' ? (
          <Button type="submit" size="lg" disabled={sending}>
            {sending ? translate('reportForm.sending') : translate('reportForm.submit')}
          </Button>
        ) : (
          step !== 'type' && (
            <Button size="lg" onClick={goNext}>
              {translate('reportForm.next')}
            </Button>
          )
        )}
      </div>
    </form>
  );
}
