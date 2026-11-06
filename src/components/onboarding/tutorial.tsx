'use client';

import { BellRing, Map as MapIcon, Megaphone, PlayCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { interpolate, translate } from '@/i18n';

// Tutoriel de premier lancement (EXG-38) : proposé à la première visite, ignorable, rejouable
// depuis « Apprendre ». Le passage est mémorisé sur l'appareil seulement.

const STORAGE_KEY = 'ba-tutorial-seen';

const STEPS = [
  { icon: Megaphone, title: 'tutorial.step1Title', body: 'tutorial.step1Body' },
  { icon: MapIcon, title: 'tutorial.step2Title', body: 'tutorial.step2Body' },
  { icon: BellRing, title: 'tutorial.step3Title', body: 'tutorial.step3Body' },
] as const;

function markSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Stockage indisponible (navigation privée) : le tutoriel sera reproposé, sans erreur.
  }
}

function TutorialDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step]!;
  const Icon = current.icon;
  const close = () => {
    markSeen();
    setStep(0);
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      title={translate('tutorial.title')}
      footer={
        <div className="flex flex-wrap justify-between gap-2">
          <Button type="button" variant="ghost" onClick={close}>
            {translate('tutorial.skip')}
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
                {translate('tutorial.previous')}
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={() => setStep(step + 1)}>
                {translate('tutorial.next')}
              </Button>
            ) : (
              <Button type="button" onClick={close}>
                {translate('tutorial.finish')}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-3" data-testid="tutorial-step">
        <p className="text-muted text-sm">
          {interpolate(translate('tutorial.step'), { current: step + 1, total: STEPS.length })}
        </p>
        <Icon aria-hidden="true" className="text-water size-10" />
        <p className="font-heading text-xl font-semibold">{translate(current.title)}</p>
        <p>{translate(current.body)}</p>
      </div>
    </Dialog>
  );
}

/**
 * Bandeau de première visite (accueil) : carte flottante en bas d'écran, qui ne décale pas
 * la page (pas de décalage de mise en page), et se ferme d'un geste.
 */
export function TutorialPrompt() {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      seen = false;
    }
    if (!seen) {
      const timer = setTimeout(() => setVisible(true), 0);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!visible) return null;
  return (
    <>
      <div
        className="rounded-card border-water bg-surface-raised shadow-soft fixed inset-x-4 bottom-4 z-[1100] mx-auto flex max-w-xl flex-wrap items-center justify-between gap-3 border-2 p-4"
        data-testid="tutorial-prompt"
      >
        <div>
          <p className="font-semibold">{translate('tutorial.promptTitle')}</p>
          <p className="text-sm">{translate('tutorial.promptBody')}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={() => setOpen(true)}>
            <PlayCircle aria-hidden="true" />
            {translate('tutorial.start')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              markSeen();
              setVisible(false);
            }}
          >
            <X aria-hidden="true" />
            {translate('tutorial.skip')}
          </Button>
        </div>
      </div>
      <TutorialDialog
        open={open}
        onClose={() => {
          setOpen(false);
          setVisible(false);
        }}
      />
    </>
  );
}

/** Bouton « Revoir le tutoriel » (page Apprendre). */
export function TutorialReplayButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <PlayCircle aria-hidden="true" />
        {translate('learn.tutorialReplay')}
      </Button>
      <TutorialDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
