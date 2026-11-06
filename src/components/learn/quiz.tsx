'use client';

import { CircleCheck, CircleX, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { interpolate, translate } from '@/i18n';

export type QuizQuestion = {
  id: string;
  question: string;
  options: { key: 'a' | 'b' | 'c'; label: string }[];
  answer: 'a' | 'b' | 'c';
  why: string;
};

/** Quiz corrigé sur l'appareil : aucune réponse n'est envoyée ni conservée. */
export function Quiz({ name, questions }: { name: string; questions: QuizQuestion[] }) {
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const score = questions.filter((q) => choices[q.id] === q.answer).length;

  return (
    <form
      className="space-y-4"
      data-testid={`quiz-${name}`}
      onSubmit={(event) => {
        event.preventDefault();
        setChecked(true);
      }}
    >
      {questions.map((q, index) => {
        const correct = choices[q.id] === q.answer;
        return (
          <fieldset key={q.id} className="space-y-2">
            <legend className="font-semibold">
              {index + 1}. {q.question}
            </legend>
            {q.options.map((option) => (
              <label key={option.key} className="min-h-touch flex items-center gap-3">
                <input
                  type="radio"
                  name={`${name}-${q.id}`}
                  value={option.key}
                  checked={choices[q.id] === option.key}
                  disabled={checked}
                  onChange={() => setChoices((c) => ({ ...c, [q.id]: option.key }))}
                  className="size-5 shrink-0"
                />
                {option.label}
              </label>
            ))}
            {checked && (
              <p
                role="status"
                className={`flex items-start gap-2 text-sm ${correct ? 'text-safe' : 'text-danger'}`}
              >
                {correct ? (
                  <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                ) : (
                  <CircleX aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                )}
                <span>
                  <span className="font-semibold">
                    {translate(correct ? 'learn.correct' : 'learn.wrong')}
                  </span>{' '}
                  <span className="text-ink">{q.why}</span>
                </span>
              </p>
            )}
          </fieldset>
        );
      })}
      {checked ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-heading text-lg font-semibold">
            {interpolate(translate('learn.score'), { score, total: questions.length })}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setChoices({});
              setChecked(false);
            }}
          >
            <RotateCcw aria-hidden="true" />
            {translate('learn.retry')}
          </Button>
        </div>
      ) : (
        <Button type="submit" disabled={Object.keys(choices).length < questions.length}>
          {translate('learn.check')}
        </Button>
      )}
    </form>
  );
}
