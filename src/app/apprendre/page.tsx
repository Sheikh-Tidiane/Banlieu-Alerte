import type { Metadata } from 'next';
import { EmergencyNumbers } from '@/components/emergency/emergency-numbers';
import { PageShell } from '@/components/layout/page-shell';
import { Quiz, type QuizQuestion } from '@/components/learn/quiz';
import { TutorialReplayButton } from '@/components/onboarding/tutorial';
import { Card } from '@/components/ui/card';
import { StateBanner } from '@/components/ui/states';
import { translate, type TranslationKey } from '@/i18n';

export const metadata: Metadata = { title: translate('learn.title') };

const ADVICE = ['before', 'during', 'after'] as const;
const COURSES = ['floods', 'sanitation', 'prevention'] as const;
type Course = (typeof COURSES)[number];

/** Questions d'un mini-cours, lues dans le dictionnaire (q1 à q3, options a à c). */
function questionsOf(course: Course): QuizQuestion[] {
  return (['q1', 'q2', 'q3'] as const).map((q) => {
    const key = (suffix: string) => `learn.${course}.${q}${suffix}` as TranslationKey;
    return {
      id: q,
      question: translate(key('')),
      options: (['a', 'b', 'c'] as const).map((option) => ({
        key: option,
        label: translate(key(option)),
      })),
      answer: translate(key('Answer')) as 'a' | 'b' | 'c',
      why: translate(key('Why')),
    };
  });
}

export default function LearnPage() {
  return (
    <PageShell className="max-w-3xl space-y-10">
      <section className="space-y-3">
        <h1 className="text-primary text-3xl font-bold">{translate('learn.title')}</h1>
        <p className="text-muted text-lg">{translate('learn.lead')}</p>
        <StateBanner kind="info" title={translate('learn.disclaimer')} />
      </section>

      <section aria-labelledby="advice" className="space-y-4">
        <h2 id="advice" className="text-2xl font-semibold">
          {translate('learn.adviceTitle')}
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {ADVICE.map((moment) => (
            <Card key={moment} className="space-y-2">
              <h3 className="font-heading text-lg font-semibold">
                {translate(`learn.${moment}.title`)}
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {(['a', 'b', 'c', 'd'] as const).map((item) => (
                  <li key={item}>{translate(`learn.${moment}.${item}`)}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="courses" className="space-y-6">
        <h2 id="courses" className="text-2xl font-semibold">
          {translate('learn.coursesTitle')}
        </h2>
        {COURSES.map((course) => (
          <Card key={course} className="space-y-4">
            <h3 className="font-heading text-xl font-semibold">
              {translate(`learn.${course}.title`)}
            </h3>
            {(['p1', 'p2', 'p3'] as const).map((p) => (
              <p key={p}>{translate(`learn.${course}.${p}`)}</p>
            ))}
            <div className="border-line space-y-3 border-t pt-4">
              <p className="font-semibold">{translate('learn.quizTitle')}</p>
              <p className="text-muted text-sm">{translate('learn.quizHint')}</p>
              <Quiz name={course} questions={questionsOf(course)} />
            </div>
          </Card>
        ))}
      </section>

      <section aria-labelledby="tutorial" className="space-y-3">
        <h2 id="tutorial" className="text-2xl font-semibold">
          {translate('learn.tutorialTitle')}
        </h2>
        <TutorialReplayButton />
      </section>

      <section aria-labelledby="emergency" className="space-y-3">
        <h2 id="emergency" className="text-danger text-2xl font-semibold">
          {translate('emergency.title')}
        </h2>
        <EmergencyNumbers />
      </section>
    </PageShell>
  );
}
