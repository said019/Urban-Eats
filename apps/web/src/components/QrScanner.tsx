"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const SCAN_BOX_SIZE = 260;
const SCANNING_STATE = 2;
const PAUSED_STATE = 3;
const CAMERA_ERROR =
  'No se detectó una cámara disponible. Revisa permisos del navegador o usa un teléfono/tablet con cámara.';

type ScannerInstance = {
  start: (
    cameraIdOrConfig: string | MediaTrackConstraints,
    configuration: {
      fps: number;
      qrbox: (viewfinderWidth: number, viewfinderHeight: number) => { width: number; height: number };
    },
    qrCodeSuccessCallback: (decodedText: string) => void,
    qrCodeErrorCallback: () => void
  ) => Promise<null>;
  stop: () => Promise<void>;
  clear?: () => void;
  getState?: () => number;
};

type CameraDevice = {
  id: string;
  label: string;
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
    let didScan = false;
    setError('');

    const safeStopScanner = async (scanner: ScannerInstance | null) => {
      if (!scanner) return;

      try {
        const state = scanner.getState?.();
        if (state === SCANNING_STATE || state === PAUSED_STATE) {
          await scanner.stop();
        }
      } catch {
        // html5-qrcode throws if stop() is called before the camera starts.
      }

      try {
        scanner.clear?.();
      } catch {
        // Ignore cleanup errors from a partially initialized scanner.
      }
    };

    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!mounted || !containerRef.current) return;

        const scanner = new Html5Qrcode('qr-scanner-region') as ScannerInstance;
        scannerRef.current = scanner;
        const config = {
          fps: 10,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const maxAvailable = Math.max(120, Math.min(viewfinderWidth, viewfinderHeight) - 24);
            const size = Math.min(SCAN_BOX_SIZE, maxAvailable);
            return { width: size, height: size };
          },
        };
        const onSuccess = async (decoded: string) => {
          if (!mounted || didScan) return;
          didScan = true;

          // UUID puro o cualquier URL que incluya el UUID del cliente.
          const match = decoded.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
          const clientId = match ? match[0] : decoded.trim();
          await safeStopScanner(scanner);
          onScan(clientId);
        };

        let cameras: CameraDevice[] = [];
        try {
          cameras = await Html5Qrcode.getCameras();
        } catch {
          cameras = [];
        }

        const backCamera = cameras.find((camera) =>
          /back|rear|environment|trasera|posterior/i.test(camera.label)
        );
        const preferredCamera = backCamera || cameras[cameras.length - 1];
        const fallbacks: Array<string | MediaTrackConstraints> = [
          ...(preferredCamera ? [preferredCamera.id] : []),
          ...cameras.filter((camera) => camera.id !== preferredCamera?.id).map((camera) => camera.id),
          { facingMode: { ideal: 'environment' } },
          { facingMode: { ideal: 'user' } },
        ];

        let lastError: unknown = null;
        for (const cameraConfig of fallbacks) {
          try {
            await scanner.start(cameraConfig, config, onSuccess, () => {});
            lastError = null;
            break;
          } catch (startError) {
            lastError = startError;
          }
        }

        if (lastError) {
          throw lastError;
        }
      } catch (err: unknown) {
        console.error('[QR] Error:', err);
        const message = err instanceof Error ? err.message : '';
        setError(/notfound|requested device not found|no cameras/i.test(message) ? CAMERA_ERROR : message || CAMERA_ERROR);
      }
    })();

    return () => {
      mounted = false;
      void safeStopScanner(scannerRef.current);
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
