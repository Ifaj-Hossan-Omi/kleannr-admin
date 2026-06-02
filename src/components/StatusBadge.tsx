export type StatusTone = 'neutral' | 'flow' | 'aqua' | 'success' | 'rose';

const TONES: Record<StatusTone, { bg: string; fg: string; dot: string }> = {
  neutral: { bg: 'rgba(91,103,110,0.11)', fg: '#3c474d', dot: '#8b969c' },
  flow: { bg: 'rgba(18,102,132,0.12)', fg: '#0d5067', dot: '#126684' },
  aqua: { bg: 'rgba(69,178,218,0.18)', fg: '#05617f', dot: '#1f9cc6' },
  success: { bg: 'rgba(22,160,111,0.15)', fg: '#0c6b4e', dot: '#16a06f' },
  rose: { bg: 'rgba(201,82,102,0.14)', fg: '#8f2c3e', dot: '#c95266' },
};

export function StatusBadge({ tone, label }: { tone: StatusTone; label: string }) {
  const t = TONES[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: t.bg,
        color: t.fg,
        padding: '4px 11px 4px 9px',
        borderRadius: 9999,
        fontSize: '0.74rem',
        fontWeight: 600,
        lineHeight: 1.45,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 9999, background: t.dot, flex: 'none' }} />
      {label}
    </span>
  );
}
