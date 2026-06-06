interface Window {
  pendo: {
    initialize: (options: Record<string, unknown>) => void;
    identify:   (options: Record<string, unknown>) => void;
    track:      (event: string, properties?: Record<string, unknown>) => void;
  };
}
