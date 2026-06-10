import { AlertCircle, Bot, CheckCircle, Loader } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { type BotStatus, DEFAULT_BOT_TOKEN, DEFAULT_BOT_URL, checkBotHealth, pairViaBotApi } from '@/shared/autotest';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { toError } from '@/shared/utils';
import { type EnvironmentId, environmentUseCase } from '@/domains/application';

type SigningBotPanelProps = {
  /** The QR deeplink payload, available when pairingStatus.step === 'pairing' */
  qrPayload: string | null;
  environmentId: EnvironmentId;
};

export const SigningBotPanel = ({ qrPayload, environmentId }: SigningBotPanelProps) => {
  const { t } = useTranslation();
  const [botUrl, setBotUrl] = useState(DEFAULT_BOT_URL);
  const [botToken, setBotToken] = useState(DEFAULT_BOT_TOKEN);
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState<BotStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [botReachable, setBotReachable] = useState<boolean | null>(null);
  const [pairedUser, setPairedUser] = useState<string | null>(null);

  const pairingInFlight = useRef(false);

  // Check bot health on mount and when URL/token changes (debounced, with retry on failure)
  useEffect(() => {
    if (!botUrl.startsWith('http://') && !botUrl.startsWith('https://')) {
      setBotReachable(null);
      return;
    }

    setBotReachable(null);
    const ctrl = new AbortController();
    let timerId: ReturnType<typeof setTimeout>;

    const runCheck = async () => {
      const ok = await checkBotHealth(botUrl, botToken || undefined);
      if (ctrl.signal.aborted) return;
      setBotReachable(ok);
      if (!ok) {
        // Retry every 2 s until reachable or effect is cleaned up
        timerId = setTimeout(runCheck, 2000);
      }
    };

    timerId = setTimeout(runCheck, 500);

    return () => {
      clearTimeout(timerId);
      ctrl.abort();
    };
  }, [botUrl, botToken]);

  const handlePair = useCallback(async () => {
    if (!qrPayload || pairingInFlight.current) return;

    pairingInFlight.current = true;
    setStatus('pairing');
    setError(null);

    try {
      const result = await pairViaBotApi(botUrl, qrPayload, {
        username: username || undefined,
        network: (await environmentUseCase.getById(environmentId)).botNetwork,
        token: botToken || undefined,
      });
      setStatus('paired');
      setPairedUser(result.user.username);
    } catch (err) {
      setStatus('error');
      setError(toError(err).message);
    } finally {
      pairingInFlight.current = false;
    }
  }, [botUrl, botToken, username, environmentId, qrPayload]);

  const statusIcon = {
    idle: <Bot className="h-5 w-5 text-text-tertiary" />,
    connecting: <Loader className="h-5 w-5 animate-spin text-primary" />,
    pairing: <Loader className="h-5 w-5 animate-spin text-primary" />,
    paired: <CheckCircle className="text-positive h-5 w-5" />,
    error: <AlertCircle className="text-negative h-5 w-5" />,
  };

  const statusLabel: Record<BotStatus, string> = {
    idle: t('feature.signingBotAutopair.statusIdle'),
    connecting: t('feature.signingBotAutopair.statusConnecting'),
    pairing: t('feature.signingBotAutopair.statusPairing'),
    paired: t('feature.signingBotAutopair.statusPaired', { user: pairedUser ?? '' }),
    error: t('feature.signingBotAutopair.statusError'),
  };

  return (
    <div
      data-testid={TEST_IDS.signingBotPanel}
      className="bg-general-card flex w-full flex-col gap-2 rounded-2xl border border-general-border p-3"
    >
      {/* Header row */}
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold tracking-wide text-text-primary uppercase">
          {t('feature.signingBotAutopair.title')}
        </span>
        {/* Status */}
        <div
          data-testid={TEST_IDS.signingBotStatus}
          className="ml-auto flex items-center gap-2 rounded-lg bg-general-muted px-2.5 py-1"
        >
          {statusIcon[status]}
          <span className="text-xs text-text-secondary">{statusLabel[status]}</span>
        </div>
      </div>

      {/* Inputs row */}
      <div className="flex items-end gap-2">
        {/* Bot URL */}
        <div className="min-w-0 flex-[2]">
          <label className="mb-1 block text-[11px] text-text-tertiary">{t('feature.signingBotAutopair.botUrlLabel')}</label>
          <div className="flex items-center gap-1.5">
            <input
              data-testid={TEST_IDS.signingBotUrlInput}
              type="text"
              value={botUrl}
              disabled={status === 'pairing' || status === 'paired'}
              className="w-full rounded-lg border border-general-border bg-general-muted px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-primary disabled:opacity-50"
              placeholder="http://localhost:3737"
              onChange={e => setBotUrl(e.target.value)}
            />
            {botReachable === true && (
              <span
                data-testid={TEST_IDS.signingBotReachable}
                className="bg-positive h-2 w-2 shrink-0 rounded-full"
                title={t('feature.signingBotAutopair.botReachable')}
              />
            )}
            {botReachable === false && (
              <span
                className="bg-negative h-2 w-2 shrink-0 rounded-full"
                title={t('feature.signingBotAutopair.botUnreachable')}
              />
            )}
            {botReachable === null && <span className="h-2 w-2 shrink-0 rounded-full bg-text-tertiary opacity-30" />}
          </div>
        </div>

        {/* Token */}
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-[11px] text-text-tertiary">{t('feature.signingBotAutopair.tokenLabel')}</label>
          <input
            data-testid={TEST_IDS.signingBotTokenInput}
            type="password"
            value={botToken}
            disabled={status === 'pairing' || status === 'paired'}
            className="w-full rounded-lg border border-general-border bg-general-muted px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-primary disabled:opacity-50"
            placeholder="Bearer token"
            onChange={e => setBotToken(e.target.value)}
          />
        </div>

        {/* Username */}
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-[11px] text-text-tertiary">{t('feature.signingBotAutopair.usernameLabel')}</label>
          <input
            data-testid={TEST_IDS.signingBotUsernameInput}
            type="text"
            value={username}
            disabled={status === 'pairing' || status === 'paired'}
            className="w-full rounded-lg border border-general-border bg-general-muted px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-primary disabled:opacity-50"
            placeholder="alice"
            onChange={e => setUsername(e.target.value)}
          />
        </div>

        {/* Action */}
        <div data-testid={TEST_IDS.signingBotConnect}>
          {status !== 'paired' ? (
            <button
              className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium whitespace-nowrap text-primary-inverse transition-colors hover:opacity-90 disabled:opacity-40"
              disabled={!qrPayload || status === 'pairing'}
              onClick={handlePair}
            >
              {status === 'pairing'
                ? t('feature.signingBotAutopair.connectingButton')
                : t('feature.signingBotAutopair.connectButton')}
            </button>
          ) : (
            <div className="bg-positive/10 flex items-center gap-1.5 rounded-lg px-4 py-1.5">
              <CheckCircle className="text-positive h-3.5 w-3.5" />
              <span className="text-positive text-xs font-medium whitespace-nowrap">
                {t('feature.signingBotAutopair.connected')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Error / waiting messages */}
      {error && <p className="text-negative text-[11px] leading-tight">{error}</p>}
      {!qrPayload && status === 'idle' && (
        <p className="text-[11px] text-text-tertiary">{t('feature.signingBotAutopair.waitingQr')}</p>
      )}
    </div>
  );
};
