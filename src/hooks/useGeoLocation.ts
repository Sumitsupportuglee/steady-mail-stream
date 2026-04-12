import { useEffect, useState } from 'react';

export function useIsIndianUser() {
  const [isIndian, setIsIndian] = useState<boolean | null>(null);

  useEffect(() => {
    // Try timezone-based detection first (no permission needed)
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.startsWith('Asia/Kolkata') || tz.startsWith('Asia/Calcutta')) {
      setIsIndian(true);
      return;
    }

    // Try locale-based detection
    const locale = navigator.language || '';
    if (locale.includes('IN') || locale === 'hi' || locale.startsWith('hi-')) {
      setIsIndian(true);
      return;
    }

    // Default to non-Indian if timezone doesn't match
    setIsIndian(false);
  }, []);

  return isIndian;
}
