import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Card, CardBody, CardHeader } from '@vinylly/ui';
import { useLocale } from '../lib/locale-store';
import { useSettings } from '../lib/settings-store';
import { resetProvidersRegistry } from '../lib/providers';
import { VinylMark } from './VinylMark';

type Step = 'language' | 'token';

export function Onboarding() {
  const { t, i18n } = useTranslation();
  const setLocale = useLocale((s) => s.setLocale);
  const setDiscogsToken = useSettings((s) => s.setDiscogsToken);
  const setOnboardingDone = useSettings((s) => s.setOnboardingDone);
  const [step, setStep] = useState<Step>('language');
  const [selectedLang, setSelectedLang] = useState(i18n.language?.slice(0, 2) ?? 'ru');
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);

  const onLanguageNext = () => {
    setLocale(selectedLang);
    setStep('token');
  };

  const onSkip = () => {
    setOnboardingDone();
  };

  const onStart = async () => {
    setSaving(true);
    try {
      if (token.trim()) {
        await setDiscogsToken(token.trim());
        resetProvidersRegistry();
      }
      setOnboardingDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-surface flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="text-fg-brand mx-auto mb-4 flex h-14 w-14 items-center justify-center">
            <VinylMark className="h-14 w-14" />
          </div>
          <h1 className="text-fg-heading text-2xl font-semibold">{t('settings:onboarding.title')}</h1>
        </div>

        <Card>
          {step === 'language' ? (
            <>
              <CardHeader>
                <h2 className="text-fg-heading text-center text-lg font-semibold">
                  {t('settings:onboarding.step_language')}
                </h2>
              </CardHeader>
              <CardBody>
                <div role="radiogroup" aria-label={t('settings:onboarding.step_language')} className="flex flex-col gap-4">
                  {[
                    { value: 'ru', label: 'Русский' },
                    { value: 'en', label: 'English' },
                  ].map((lang) => {
                    const selected = selectedLang === lang.value;
                    return (
                      <button
                        key={lang.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setSelectedLang(lang.value)}
                        className={`rounded-base flex items-center gap-4 px-6 py-5 text-left text-base font-medium transition-neu ${
                          selected
                            ? 'text-fg-brand-strong bg-surface shadow-neu-inset border border-transparent'
                            : 'text-fg-body bg-surface shadow-neu-sm hover:shadow-neu-md border border-transparent'
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-base font-mono text-sm font-semibold ${
                            selected
                              ? 'bg-brand-softer text-fg-brand-strong'
                              : 'bg-surface text-fg-body-subtle shadow-neu-inset'
                          }`}
                        >
                          {lang.value.toUpperCase()}
                        </span>
                        <span>{lang.label}</span>
                        {selected ? (
                          <span className="ml-auto text-fg-brand">
                            <CheckSmallIcon />
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </CardBody>
              <div className="flex justify-end px-6 pb-6">
                <Button onClick={onLanguageNext} leftIcon={<ArrowRightIcon />}>
                  {t('settings:onboarding.continue')}
                </Button>
              </div>
            </>
          ) : (
            <>
              <CardHeader>
                <h2 className="text-fg-heading text-center text-lg font-semibold">
                  {t('settings:onboarding.step_token')}
                </h2>
              </CardHeader>
              <CardBody className="space-y-6">
                <p className="text-fg-body text-sm leading-relaxed">
                  {t('settings:onboarding.step_token_desc')}
                </p>

                {/* Instructions */}
                <div className="rounded-base border-border-default bg-surface shadow-neu-inset space-y-3 border px-6 py-5">
                  <p className="text-fg-body text-sm">{t('settings:onboarding.step_token_instruction_1')}</p>
                  <p className="text-fg-body text-sm">{t('settings:onboarding.step_token_instruction_2')}</p>
                  <p className="text-fg-body text-sm">{t('settings:onboarding.step_token_instruction_3')}</p>
                </div>

                <Input
                  label={t('settings:discogs.token_label')}
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={t('settings:discogs.placeholder_empty')}
                  autoComplete="off"
                  spellCheck={false}
                />
              </CardBody>
              <div className="flex items-center justify-between px-6 pb-6">
                <Button variant="ghost" onClick={onSkip}>
                  {t('settings:onboarding.skip')}
                </Button>
                <Button onClick={() => void onStart()} disabled={saving}>
                  {saving ? t('common:loading.generic') : t('settings:onboarding.start')}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function CheckSmallIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5" aria-hidden>
      <path d="M6 12l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
