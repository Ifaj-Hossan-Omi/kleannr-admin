import { useEffect, useState } from 'react';
import { Badge, Button, Drawer, Group, Select, Stack, Textarea } from '@mantine/core';
import { IconLock, IconReplace, IconUserShare } from '@tabler/icons-react';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDateTime, formatTaka } from '../../lib/format';
import { ORDER_STATUS, ORDER_STATUS_TONE, isTerminal, type AdminOrder } from './api';
import { useOverrideStatus, useReassignRider } from './hooks';
import s from './OrdersPage.module.css';

interface Props {
  order: AdminOrder | null;
  onClose: () => void;
  areaName: (id: string | null) => string;
  vendorName: (id: string | null) => string;
  riderName: (id: string | null) => string;
  riderOptions: { value: string; label: string }[];
}

export function OrderDetailDrawer({ order, onClose, areaName, vendorName, riderName, riderOptions }: Props) {
  const [rider, setRider] = useState<string | null>(null);
  const [overrideStatusVal, setOverrideStatusVal] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const reassign = useReassignRider();
  const override = useOverrideStatus();

  useEffect(() => {
    if (order) {
      setRider(order.riderId);
      setOverrideStatusVal(String(order.status));
      setReason('');
    }
  }, [order]);

  const terminal = order ? isTerminal(order.status) : false;

  const doReassign = () => {
    if (!order || !rider) return;
    reassign.mutate({ orderId: order.id, riderId: rider }, { onSuccess: onClose });
  };
  const doOverride = () => {
    if (!order || !overrideStatusVal || !reason.trim()) return;
    override.mutate({ orderId: order.id, newStatus: Number(overrideStatusVal), reason: reason.trim() }, { onSuccess: onClose });
  };

  return (
    <Drawer opened={!!order} onClose={onClose} position="right" size={500} padding="xl" overlayProps={{ backgroundOpacity: 0.35, blur: 3 }}>
      {order && (
        <>
          <div className={s.dHeader}>
            <div className={s.dOrderNum}>{order.orderNumber}</div>
            <div className={s.dMeta}>
              <StatusBadge tone={ORDER_STATUS_TONE[order.status]} label={ORDER_STATUS[order.status]} />
              <Badge variant="light" radius="xl" color={order.paymentStatus === 1 ? 'aqua' : 'gray'}>
                {order.paymentStatus === 1 ? 'Paid · COD' : 'COD · pending'}
              </Badge>
              <span className={s.dPlaced}>Placed {formatDateTime(order.placedAt)}</span>
            </div>
          </div>

          <div className={s.section}>
            <div className={s.summary}>
              <div className={s.summaryTotal}><span>Order total</span><span>{formatTaka(order.total)}</span></div>
            </div>
          </div>

          <div className={s.section}>
            <div className={s.sectionTitle}>Details</div>
            <div className={s.detailGrid}>
              <div><div className={s.detailLabel}>Service area</div><div className={s.detailValue}>{areaName(order.serviceAreaId)}</div></div>
              <div><div className={s.detailLabel}>Vendor</div><div className={s.detailValue}>{vendorName(order.vendorId)}</div></div>
              <div><div className={s.detailLabel}>Rider</div><div className={s.detailValue}>{riderName(order.riderId)}</div></div>
              <div><div className={s.detailLabel}>Payment</div><div className={s.detailValue}>{order.paymentStatus === 1 ? 'Paid (COD)' : 'COD · pending'}</div></div>
              {order.deliveredAt && <div><div className={s.detailLabel}>Delivered</div><div className={s.detailValue}>{formatDateTime(order.deliveredAt)}</div></div>}
              {order.cancelledAt && <div><div className={s.detailLabel}>Cancelled</div><div className={s.detailValue}>{formatDateTime(order.cancelledAt)}</div></div>}
            </div>
            <div className={s.actionHint} style={{ marginTop: 10 }}>
              Line items, the status timeline, and customer details aren’t exposed by the admin API yet (backend-requests BR-4).
            </div>
          </div>

          <div className={s.section}>
            <div className={s.sectionTitle}>Admin actions</div>
            {terminal ? (
              <div className={s.terminalNote}>
                <IconLock size={18} />
                This order is {ORDER_STATUS[order.status]} — its status is final and can’t be changed.
              </div>
            ) : (
              <>
                <div className={s.actionBlock}>
                  <div className={s.actionTitle}>Reassign rider</div>
                  <div className={s.actionHint}>Move this order to another rider. Both riders are notified.</div>
                  <Group wrap="nowrap" align="flex-end">
                    <Select data={riderOptions} value={rider} onChange={setRider} variant="filled" radius="md" placeholder="Select rider" style={{ flex: 1 }} comboboxProps={{ withinPortal: true }} />
                    <Button variant="light" color="brand" loading={reassign.isPending} disabled={!rider || rider === order.riderId} leftSection={<IconUserShare size={16} />} onClick={doReassign}>Reassign</Button>
                  </Group>
                </div>

                <div className={s.actionBlock}>
                  <div className={s.actionTitle}>Override status</div>
                  <div className={s.actionHint}>Force a status change. A reason is required and stored permanently.</div>
                  <Stack gap="sm">
                    <Select data={ORDER_STATUS.map((label, i) => ({ value: String(i), label }))} value={overrideStatusVal} onChange={setOverrideStatusVal} variant="filled" radius="md" comboboxProps={{ withinPortal: true }} />
                    <Textarea placeholder="Reason (required) — e.g. rider's phone died, picked up clothes manually" value={reason} onChange={(e) => setReason(e.currentTarget.value)} variant="filled" radius="md" autosize minRows={2} />
                    <Button variant="gradient" loading={override.isPending} disabled={!reason.trim() || overrideStatusVal === String(order.status)} leftSection={<IconReplace size={16} />} onClick={doOverride}>Override status</Button>
                  </Stack>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </Drawer>
  );
}
