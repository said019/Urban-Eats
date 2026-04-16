"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onScan: (clientId: string) => void;
};

export function QrScanner({ isOpen, onClose, onScan }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<any>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;

    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!mounted || !containerRef.current) return;

        const scanner = new Html5Qrcode('qr-scanner-region');
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decoded: string) => {
            if (!mounted) return;
            // UUID puro o URL /card/<uuid>
            const match = decoded.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
            const clientId = match ? match[0] : decoded.trim();
            scanner.stop().catch(() => {});
            onScan(clientId);
          },
          () => {}
        );
      } catch (err: any) {
        console.error('[QR] Error:', err);
        setError(err.message || 'No se pudo acceder a la cámara. Permite el acceso o usa HTTPS.');
      }
    })();

    return () => {
      mounted = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear?.();
      }
    };
  }, [isOpen, onScan]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h3 className="text-white font-black tracking-widest text-sm">ESCANEAR QR</h3>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative aspect-square bg-black">
          <div id="qr-scanner-region" ref={containerRef} className="w-full h-full" />
          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-6 bg-black/80">
              <p className="text-red-400 text-sm text-center font-medium">{error}</p>
            </div>
          )}
        </div>

        <div className="p-4 text-center">
          <p className="text-zinc-500 text-xs font-medium tracking-wide">
            Apunta la cámara al código QR de la tarjeta del cliente
          </p>
        </div>
      </div>
    </div>
  );
}
