"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const SCAN_BOX_SIZE = 260;

type ScannerInstance = {
  stop: () => Promise<void>;
  clear?: () => void;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onScan: (clientId: string) => void;
};

export function QrScanner({ isOpen, onClose, onScan }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<ScannerInstance | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    setError('');

    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!mounted || !containerRef.current) return;

        const scanner = new Html5Qrcode('qr-scanner-region');
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
              const maxAvailable = Math.max(120, Math.min(viewfinderWidth, viewfinderHeight) - 24);
              const size = Math.min(SCAN_BOX_SIZE, maxAvailable);
              return { width: size, height: size };
            },
          },
          (decoded: string) => {
            if (!mounted) return;
            // UUID puro o cualquier URL que incluya el UUID del cliente.
            const match = decoded.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
            const clientId = match ? match[0] : decoded.trim();
            scanner.stop().catch(() => {});
            onScan(clientId);
          },
          () => {}
        );
      } catch (err: unknown) {
        console.error('[QR] Error:', err);
        setError(err instanceof Error ? err.message : 'No se pudo acceder a la cámara. Permite el acceso o usa HTTPS.');
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

        <div className="relative bg-black p-5 flex justify-center">
          <div className="relative w-[280px] max-w-full aspect-square bg-black border-2 border-brand-orange rounded-lg overflow-hidden">
            <div id="qr-scanner-region" ref={containerRef} className="absolute inset-0 [&_video]:object-cover" />
            <div className="pointer-events-none absolute inset-4 border border-white/70 rounded-md shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-px w-16 -translate-x-1/2 bg-brand-yellow/80" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-px -translate-y-1/2 bg-brand-yellow/80" />
          </div>
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
