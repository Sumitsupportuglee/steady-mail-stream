import { useEffect } from 'react';

export function ElevenLabsWidget() {
  useEffect(() => {
    // Load the ElevenLabs convai widget script
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
    script.async = true;
    script.type = 'text/javascript';
    document.body.appendChild(script);

    // Create the widget element
    const widget = document.createElement('elevenlabs-convai');
    widget.setAttribute('agent-id', 'agent_7901knwbenfpf6db5em7qe2xa0ag');
    widget.style.position = 'fixed';
    widget.style.bottom = '20px';
    widget.style.left = '20px';
    widget.style.zIndex = '9999';
    document.body.appendChild(widget);

    return () => {
      widget.remove();
      script.remove();
    };
  }, []);

  return null;
}
