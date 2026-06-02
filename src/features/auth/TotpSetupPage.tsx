import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Code, Image, Loader, PinInput, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconShieldLock } from '@tabler/icons-react';
import { useTotpConfirm, useTotpSetup } from './hooks';
import s from './LoginPage.module.css';

export function TotpSetupPage() {
  const navigate = useNavigate();
  const setup = useTotpSetup();
  const confirm = useTotpConfirm();
  const [code, setCode] = useState('');

  // Fetch the QR / manual key once on mount.
  const { mutate: runSetup } = setup;
  useEffect(() => {
    runSetup();
  }, [runSetup]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    confirm.mutate(
      { code },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: 'Two-factor enabled. Please sign in.' });
          navigate('/login');
        },
      },
    );
  };

  return (
    <div className={s.formPanel} style={{ minHeight: '100vh' }}>
      <form className={`${s.card} knr-card knr-fade-up`} onSubmit={onSubmit}>
        <div className={s.cardLogo}>
          <img src="/KleanNr.png" alt="" />
          <span className={s.cardWordmark}>
            Klean<em>Nr</em>
          </span>
        </div>

        <h2 style={{ marginBottom: 6 }}>Set up two-factor</h2>
        <Text c="dimmed" size="sm" mb="xl">
          Scan the QR with Google Authenticator, then enter the 6-digit code.
        </Text>

        <Stack align="center" gap="md">
          {setup.isPending && <Loader />}
          {setup.data && (
            <>
              <Image src={setup.data.qrCodeBase64} alt="TOTP QR code" w={188} h={188} radius="md" />
              <Text size="xs" c="dimmed">
                Or enter this key manually:
              </Text>
              <Code>{setup.data.manualEntryKey}</Code>
            </>
          )}
          <PinInput
            length={6}
            type="number"
            oneTimeCode
            size="md"
            aria-label="Authentication code"
            value={code}
            onChange={setCode}
          />
          <Button type="submit" variant="gradient" size="md" radius="xl" fullWidth loading={confirm.isPending} disabled={code.length !== 6}>
            Confirm &amp; enable
          </Button>
        </Stack>

        <div className={s.foot}>
          <IconShieldLock size={15} /> Enrollment
        </div>
      </form>
    </div>
  );
}
