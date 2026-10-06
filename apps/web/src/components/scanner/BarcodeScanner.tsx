import { useEffect, useId, useRef, useState } from 'react';
import { Camera, CameraOff, Keyboard, ScanBarcode } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

type Props = {
  onScan: (code: string) => void | Promise<void>;
  disabled?: boolean;
  autoFocus?: boolean;
  title?: string;
  helper?: string;
};

export function BarcodeScanner({ onScan, disabled = false, autoFocus = true, title = 'Bipar equipamento', helper = 'Use a câmera do celular ou um leitor USB.' }: Props) {
  const reactId = useId();
  const scannerId = `barcode-scanner-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const html5Ref = useRef<Html5Qrcode | null>(null);
  const lastScan = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    if (autoFocus && !disabled) inputRef.current?.focus();
  }, [autoFocus, disabled]);

  useEffect(() => () => {
    const scanner = html5Ref.current;
    if (scanner?.isScanning) scanner.stop().catch(() => undefined).finally(() => { try { scanner.clear(); } catch { /* noop */ } });
  }, []);

  const emit = async (raw: string) => {
    const code = raw.trim().toUpperCase();
    if (!code || disabled) return;
    const now = Date.now();
    if (lastScan.current.code === code && now - lastScan.current.at < 1200) return;
    lastScan.current = { code, at: now };
    setManualCode('');
    if ('vibrate' in navigator) navigator.vibrate?.(35);
    await onScan(code);
    window.setTimeout(() => inputRef.current?.focus(), 30);
  };

  const stopCamera = async () => {
    const scanner = html5Ref.current;
    if (scanner?.isScanning) {
      await scanner.stop().catch(() => undefined);
      try { scanner.clear(); } catch { /* noop */ }
    }
    html5Ref.current = null;
    setCameraOn(false);
  };

  const startCamera = async () => {
    if (disabled || cameraStarting || cameraOn) return;
    setCameraError('');
    setCameraStarting(true);
    try {
      const scanner = new Html5Qrcode(scannerId, { formatsToSupport: [Html5QrcodeSupportedFormats.CODE_128], verbose: false });
      html5Ref.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 12, qrbox: { width: 280, height: 130 }, aspectRatio: 1.777778 },
        decoded => { void emit(decoded); },
        () => undefined
      );
      setCameraOn(true);
    } catch (error) {
      html5Ref.current = null;
      const message = error instanceof Error ? error.message : String(error);
      setCameraError(message.includes('Permission') || message.includes('NotAllowed')
        ? 'Permissão de câmera negada. Libere a câmera no navegador ou use o leitor USB.'
        : 'Não foi possível iniciar a câmera. Em celular, use HTTPS ou localhost e confira a permissão do navegador.');
    } finally {
      setCameraStarting(false);
    }
  };

  return <section className="card overflow-hidden">
    <div className="border-b border-slate-200 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h3 className="font-bold text-slate-900">{title}</h3><p className="mt-0.5 text-sm text-slate-500">{helper}</p></div>
        <button type="button" disabled={disabled || cameraStarting} onClick={() => cameraOn ? void stopCamera() : void startCamera()} className="btn-secondary shrink-0">
          {cameraOn ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
          {cameraStarting ? 'Abrindo câmera...' : cameraOn ? 'Fechar câmera' : 'Usar câmera'}
        </button>
      </div>
    </div>
    <div className="space-y-4 p-4 sm:p-5">
      <div className="relative">
        <Keyboard className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input ref={inputRef} value={manualCode} onChange={e => setManualCode(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void emit(manualCode); } }} disabled={disabled} className="input pl-10 pr-12 font-mono uppercase" placeholder="Aponte o leitor USB ou digite CAM-0001 e Enter" autoComplete="off" />
        <ScanBarcode className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
      </div>
      <div className={`${cameraOn || cameraStarting ? 'block' : 'hidden'} overflow-hidden rounded-2xl bg-slate-950 p-2`}><div id={scannerId} className="min-h-[220px] overflow-hidden rounded-xl" /></div>
      {cameraError && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">{cameraError}</div>}
    </div>
  </section>;
}
