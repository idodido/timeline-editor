import { useCallback, useEffect, useRef, useState } from 'react';
import { getConfig } from '../services/kaltura-api';

interface PlayerProps {
  entryId: string;
  uiconfId: string;
  onReady: (player: any) => void;
}

export const Player = ({ entryId, uiconfId, onReady }: PlayerProps) => {
  const containerId = useRef(`kplayer_${Math.random().toString(36).slice(2)}`);
  const playerRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);

  const embed = useCallback(() => {
    const { pid, ks } = getConfig();
    if (!pid || !uiconfId || !entryId) return;

    if (document.getElementById('kalturaV7Lib')) {
      // Script already loaded — setup directly
      setup(pid, ks);
      return;
    }

    const script = document.createElement('script');
    script.id = 'kalturaV7Lib';
    script.src = `https://cdnapisec.kaltura.com/p/${pid}/embedPlaykitJs/uiconf_id/${uiconfId}/ks/${ks}`;
    script.onload = () => setup(pid, ks);
    document.head.appendChild(script);
  }, [entryId, uiconfId]);

  const setup = (pid: string, ks: string) => {
    try {
      const kp = (window as any).KalturaPlayer.setup({
        targetId: containerId.current,
        provider: { partnerId: pid, uiConfId: uiconfId, ks },
        playback: { autoplay: false },
      });
      kp.loadMedia({ entryId });
      playerRef.current = kp;
      onReady(kp);
    } catch (e) {
      console.error('Player setup failed', e);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) embed();
    return () => {
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
        const script = document.getElementById('kalturaV7Lib');
        if (script) script.remove();
      }
    };
  }, [mounted, embed]);

  return (
    <div
      id={containerId.current}
      style={{ width: '100%', height: '100%', backgroundColor: '#000' }}
    />
  );
};
