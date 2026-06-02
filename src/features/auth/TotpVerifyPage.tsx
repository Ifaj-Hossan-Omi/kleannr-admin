import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, PinInput, Stack, Text } from '@mantine/core';
import { IconShieldLock } from '@tabler/icons-react';
import { useTotpVerify } from './hooks';
import s from './LoginPage.module.css';

export function TotpVerifyPage() {
  const navigate = useNavigate();
  const verify = useTotpVerify();
  const [code, setCode] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    verify.mutate({ code }, { onSuccess: () => navigate('/') });
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

        <h2 style={{ marginBottom: 6 }}>Two-factor authentication</h2>
        <Text c="dimmed" size="sm" mb="xl">
          Enter the 6-digit code from your authenticator app.
        </Text>

        <Stack align="center" gap="lg">
          <PinInput
            length={6}
            type="number"
            oneTimeCode
            size="md"
            aria-label="Authentication code"
            value={code}
            onChange={setCode}
          />
          <Button type="submit" variant="gradient" size="md" radius="xl" fullWidth loading={verify.isPending} disabled={code.length !== 6}>
            Verify
          </Button>
        </Stack>

        <div className={s.foot}>
          <IconShieldLock size={15} /> Step 2 of 2
        </div>
      </form>
    </div>
  );
}
