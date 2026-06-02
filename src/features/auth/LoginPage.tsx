import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Anchor, Button, Group, PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import { IconBolt, IconLock, IconMapPin, IconShieldLock, IconUser } from '@tabler/icons-react';
import { useAdminLogin } from './hooks';
import s from './LoginPage.module.css';

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAdminLogin();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    login.mutate(
      { username: username.trim(), password },
      {
        onSuccess: (res) => {
          if (res.authenticated) navigate('/');
          else if (res.totpEnrollmentNeeded) navigate('/totp/setup');
          else navigate('/totp');
        },
      },
    );
  };

  return (
    <div className={s.wrap}>
      <section className={s.brandPanel}>
        <div className={s.brandTop}>
          <div className={s.brandLogoTile}>
            <img src="/KleanNr.png" alt="" />
          </div>
          <span className={s.brandWordmark}>
            Klean<em>Nr</em>
          </span>
        </div>

        <div className={s.brandCenter}>
          <div className={s.heroTile}>
            <img src="/KleanNr.png" alt="" />
          </div>
          <span className={s.eyebrowLight}>Operations Console</span>
          <h1 className={s.heroTitle}>
            Every order,
            <br />
            perfectly laundered.
          </h1>
          <p className={s.heroSub}>
            Monitor orders, riders, cash and catalog across Dhaka — one calm, clean command
            center for the whole operation.
          </p>
        </div>

        <div className={s.chips}>
          <span className={s.chip}>
            <IconMapPin size={15} /> 11 service areas
          </span>
          <span className={s.chip}>
            <IconBolt size={15} /> Live operations
          </span>
          <span className={s.chip}>
            <IconShieldLock size={15} /> 2FA secured
          </span>
        </div>
      </section>

      <section className={s.formPanel}>
        <form className={`${s.card} knr-card knr-fade-up`} onSubmit={onSubmit}>
          <div className={s.cardLogo}>
            <img src="/KleanNr.png" alt="" />
            <span className={s.cardWordmark}>
              Klean<em>Nr</em>
            </span>
          </div>

          <h2 style={{ marginBottom: 6 }}>Welcome back</h2>
          <Text c="dimmed" size="sm" mb="xl">
            Sign in to the admin console.
          </Text>

          <Stack gap="md">
            <TextInput
              label="Username"
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.currentTarget.value)}
              size="md"
              autoComplete="username"
              leftSection={<IconUser size={17} stroke={1.7} />}
            />
            <PasswordInput
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              size="md"
              autoComplete="current-password"
              leftSection={<IconLock size={17} stroke={1.7} />}
            />
            <Group justify="flex-end" mt={-6}>
              <Anchor size="xs" c="brand.6" underline="never">
                Forgot password?
              </Anchor>
            </Group>
            <Button type="submit" variant="gradient" size="md" radius="xl" fullWidth loading={login.isPending}>
              Sign in
            </Button>
          </Stack>

          <div className={s.foot}>
            <IconShieldLock size={15} /> Protected by two-factor authentication
          </div>
        </form>
      </section>
    </div>
  );
}
