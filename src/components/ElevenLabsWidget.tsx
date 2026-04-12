import { useEffect } from 'react';

let scriptLoaded = false;
let widgetAdded = false;

export function ElevenLabsWidget() {
  useEffect(() => {
    // Prevent duplicate custom element registration
    if (widgetAdded) return;

    if (!scriptLoaded) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
      script.async = true;
      script.type = 'text/javascript';
      document.body.appendChild(script);
      scriptLoaded = true;
    }

    const widget = document.createElement('elevenlabs-convai');
    widget.setAttribute('agent-id', 'agent_7901knwbenfpf6db5em7qe2xa0ag');
    widget.style.position = 'fixed';
    widget.style.bottom = '20px';
    widget.style.left = '20px';
    widget.style.zIndex = '9999';
    document.body.appendChild(widget);
    widgetAdded = true;

    return () => {
      widget.remove();
      widgetAdded = false;
    };
  }, []);

  return null;
}
