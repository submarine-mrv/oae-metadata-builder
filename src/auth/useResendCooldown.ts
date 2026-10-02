import { useEffect, useState } from "react";

const COOLDOWN_SECONDS = 60;

export function useResendCooldown() {
  const [until, setUntil] = useState(0);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (until === 0) return;
    const update = () => {
      const seconds = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0) setUntil(0);
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [until]);

  return {
    remaining,
    start: () => setUntil(Date.now() + COOLDOWN_SECONDS * 1000),
  };
}
