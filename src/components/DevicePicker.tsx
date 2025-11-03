import { transferPlayback } from '../api/spotify';
import { connectPlayer, getDeviceId, initPlayer } from '../player/sdk';
import { usePlayerStore } from '../store/usePlayerStore';

export default function DevicePicker(): JSX.Element {
  const deviceId = usePlayerStore((state) => state.deviceId);
  const log = usePlayerStore((state) => state.log);

  const retryTransfer = async () => {
    try {
      await initPlayer();
      await connectPlayer();
      const currentDevice = getDeviceId();
      if (currentDevice) {
        await transferPlayback(currentDevice, true);
      }
    } catch (error) {
      log(`Unable to transfer playback: ${(error as Error).message}`, 'error');
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-md border border-slate-800 bg-slate-900/60 px-4 py-2 text-sm text-slate-200">
      <div className="flex flex-col leading-tight">
        <span className="text-xs uppercase text-slate-500">Active Device</span>
        <span className="font-medium text-white">{deviceId ?? 'Waiting for browser player…'}</span>
      </div>
      <button
        type="button"
        onClick={retryTransfer}
        className="ml-auto rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-200 transition hover:bg-emerald-500/20"
      >
        Retry Transfer
      </button>
    </div>
  );
}
