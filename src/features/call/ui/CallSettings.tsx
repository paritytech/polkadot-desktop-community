import { ChevronRight, Mic, Video, Volume2, X } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { type CallDeviceKind, type CallDeviceSelection, type CallDevices, deviceIdForKind } from '@/shared/call-media-devices';
import { IconButton } from '@/shared/components';
import { cnTw } from '@/shared/utils';

export type CallSettingsLabels = {
  title: string;
  close: string;
  camera: string;
  microphone: string;
  output: string;
  systemDefault: string;
};

export type CallSettingsProps = {
  devices: CallDevices;
  selection: CallDeviceSelection;
  labels: CallSettingsLabels;
  onSelect: (kind: CallDeviceKind, deviceId: Nullable<string>) => void;
  onClose: VoidFunction;
};

type DeviceOption = { id: Nullable<string>; label: string };

type Row = { kind: CallDeviceKind; label: string; icon: ReactNode; devices: MediaDeviceInfo[] };

const iconFor = (kind: CallDeviceKind): ReactNode => {
  if (kind === 'camera') return <Video className="size-5" strokeWidth={1.75} />;
  if (kind === 'microphone') return <Mic className="size-5" strokeWidth={1.75} />;
  return <Volume2 className="size-5" strokeWidth={1.75} />;
};

export const CallSettings = ({ devices, selection, labels, onSelect, onClose }: CallSettingsProps) => {
  // The device row whose selection popover is open, or null when none is open.
  const [openKind, setOpenKind] = useState<Nullable<CallDeviceKind>>(null);

  const rows: Row[] = [
    { kind: 'camera', label: labels.camera, icon: iconFor('camera'), devices: devices.cameras },
    { kind: 'microphone', label: labels.microphone, icon: iconFor('microphone'), devices: devices.microphones },
    { kind: 'output', label: labels.output, icon: iconFor('output'), devices: devices.outputs },
  ];

  // Popover options for a row: an explicit "Default" (null) entry for the output
  // (a peer sends system audio to the OS default), then the enumerated devices.
  const optionsFor = (row: Row): DeviceOption[] => {
    const devices = row.devices.map((device, index) => ({
      id: device.deviceId,
      label: device.label !== '' ? device.label : `${row.label} ${index + 1}`,
    }));

    return row.kind === 'output' ? [{ id: null, label: labels.systemDefault }, ...devices] : devices;
  };

  // The visible name of the currently-selected device for a row, or the default label.
  const currentDeviceLabel = (row: Row): string => {
    const id = deviceIdForKind(selection, row.kind);
    const match = id === null ? undefined : row.devices.find(device => device.deviceId === id);
    return match !== undefined && match.label !== '' ? match.label : labels.systemDefault;
  };

  const handlePick = (kind: CallDeviceKind, deviceId: Nullable<string>): void => {
    onSelect(kind, deviceId);
    setOpenKind(null);
  };

  return (
    // A click anywhere outside a row (backdrop, card chrome) dismisses an open popover.
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-6" onClick={() => setOpenKind(null)}>
      <div className="relative flex w-full max-w-sm flex-col gap-4 rounded-xl border border-stroke-primary bg-bg-surface-container p-6 shadow-lg">
        <h2 className="pe-10 text-lg font-semibold text-fg-primary">{labels.title}</h2>
        <span className="absolute end-3 top-3 flex">
          <IconButton label={labels.close} onClick={onClose}>
            <X />
          </IconButton>
        </span>
        <div className="flex flex-col gap-2">
          {rows.map(row => {
            const selectedId = deviceIdForKind(selection, row.kind);
            return (
              // Stop propagation so clicks on the row or its popover don't hit the backdrop dismiss.
              <div key={row.kind} className="relative" onClick={event => event.stopPropagation()}>
                <button
                  type="button"
                  aria-label={row.label}
                  aria-haspopup="menu"
                  aria-expanded={openKind === row.kind}
                  className="group flex w-full items-center gap-4 rounded-xl bg-bg-surface-nested px-3 py-2 text-start"
                  onClick={() => setOpenKind(current => (current === row.kind ? null : row.kind))}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-bg-illustration-light text-fg-primary">
                      {row.icon}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm text-fg-primary">{row.label}</span>
                      <span className="truncate text-xs font-medium text-fg-tertiary">{currentDeviceLabel(row)}</span>
                    </span>
                  </span>
                  <span
                    className={cnTw(
                      'flex size-6 shrink-0 items-center justify-center rounded-full text-fg-tertiary',
                      'group-hover:bg-bg-illustration-light group-hover:text-fg-primary',
                      openKind === row.kind && 'bg-bg-illustration-light text-fg-primary',
                    )}
                  >
                    <ChevronRight className="size-4" />
                  </span>
                </button>
                {openKind === row.kind && (
                  <DevicePopover options={optionsFor(row)} selectedId={selectedId} onPick={id => handlePick(row.kind, id)} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

type DevicePopoverProps = {
  options: DeviceOption[];
  selectedId: Nullable<string>;
  onPick: (id: Nullable<string>) => void;
};

const DevicePopover = ({ options, selectedId, onPick }: DevicePopoverProps) => (
  <div
    role="menu"
    className="absolute end-0 top-full z-50 mt-1 flex max-w-full min-w-[13rem] flex-col rounded-lg border border-stroke-primary bg-bg-surface-container p-1 shadow-lg"
  >
    {options.map(option => {
      const selected = option.id === selectedId;
      return (
        <button
          key={option.id ?? '__default__'}
          type="button"
          role="menuitemradio"
          aria-checked={selected}
          aria-label={option.label}
          className="flex h-control items-center gap-2 rounded-md px-2 text-start text-sm text-fg-primary hover:bg-bg-surface-nested"
          onClick={() => onPick(option.id)}
        >
          <Radio selected={selected} />
          <span className="min-w-0 flex-1 truncate">{option.label}</span>
        </button>
      );
    })}
  </div>
);

const Radio = ({ selected }: { selected: boolean }) => (
  <span
    className={cnTw(
      'flex size-4 shrink-0 items-center justify-center rounded-full border',
      selected ? 'border-fg-primary' : 'border-fg-tertiary',
    )}
  >
    {selected && <span className="size-2 rounded-full bg-fg-primary" />}
  </span>
);
