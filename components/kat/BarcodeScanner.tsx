"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, ImageUp, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { crop, decodePhoto, getDecoder, VIDEO_VIEWS } from "@/lib/barcode";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (code: string) => void;
  /** Runs once the window has fully closed — the right moment to move the cursor. */
  onClosed?: () => void;
  /** Keep scanning after each code (piece-by-piece check-in) instead of closing. */
  continuous?: boolean;
  /** Continuous mode: result of the last scan, shown over the camera picture. */
  feedback?: { kind: "ok" | "error"; text: string } | null;
};
type Status = "starting" | "scanning" | "error";

/**
 * Reads a QR code or barcode (EAN, UPC, Code 128…) with the camera, or from a photo.
 * Live scanning needs an https:// address (or localhost); the photo button works everywhere.
 */
export function BarcodeScanner({ open, onOpenChange, onDetected, onClosed, continuous, feedback }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const paused = useRef(false); // live scanning waits while a photo is being read
  const [status, setStatus] = useState<Status>("starting");
  const [message, setMessage] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");

  // Always call the newest handler (in continuous mode the list of scanned codes changes after every scan).
  const detectedRef = useRef(onDetected);
  detectedRef.current = onDetected;
  // Continuous mode: ignore the same code while it is still in front of the camera.
  const last = useRef({ code: "", at: 0 });

  function finish(code: string) {
    code = code.trim();
    if (continuous) {
      const now = Date.now();
      if (code === last.current.code && now - last.current.at < 2500) {
        last.current.at = now;
        return;
      }
      last.current = { code, at: now };
      detectedRef.current(code);
      return;
    }
    navigator.vibrate?.(80);
    detectedRef.current(code);
    onOpenChange(false);
  }

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout>;
    setStatus("starting");
    setPhotoError("");
    last.current = { code: "", at: 0 };

    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setMessage("Live camera scanning only works when KAT OS is opened over https:// (or on localhost). Use “Take or choose a photo” below, a USB scanner, or type the code.");
        return;
      }
      try {
        // Ask for HD: small codes on cheap webcams need the extra pixels. Back camera on phones.
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        const [track] = stream.getVideoTracks();
        // Continuous autofocus where the camera supports it (phones).
        await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => {});
        const video = videoRef.current;
        if (stopped || !video) return stream.getTracks().forEach((t) => t.stop());
        video.srcObject = stream;
        await video.play();
        const decode = await getDecoder();
        if (stopped) return;
        setStatus("scanning");

        // Look at the aiming box, a closer zoom and the whole picture in turn, ~8 times a second.
        const canvas = document.createElement("canvas");
        let view = 0;
        const tick = async () => {
          if (stopped) return;
          if (!paused.current && video.readyState >= 2 && video.videoWidth) {
            const { region, size } = VIDEO_VIEWS[view++ % VIDEO_VIEWS.length];
            const code = await decode(crop(video, video.videoWidth, video.videoHeight, region, size, canvas));
            if (code && !stopped) {
              if (!continuous) {
                stopped = true;
                return finish(code);
              }
              finish(code);
            }
          }
          timer = setTimeout(tick, 120);
        };
        tick();
      } catch (e) {
        setStatus("error");
        const name = e instanceof Error ? e.name : "";
        setMessage(
          name === "NotAllowedError"
            ? "Camera permission was refused. Allow the camera for this site in the browser settings, or use “Take or choose a photo”."
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? "No camera was found on this device. Use “Take or choose a photo”, a USB scanner, or type the code."
              : "The camera could not be started (another app may be using it). Close it and try again, or use a photo.",
        );
      }
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // finish() only uses the latest props; restarting the camera on every render would be wrong
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoBusy(true);
    setPhotoError("");
    paused.current = true;
    try {
      const code = await decodePhoto(file);
      if (code) finish(code);
      else setPhotoError("No code found in that photo. Take it closer, in good light, with the code sharp and filling most of the picture.");
    } catch {
      setPhotoError("That file could not be read as an image.");
    } finally {
      paused.current = false;
      setPhotoBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" onCloseAutoFocus={(e) => {
          e.preventDefault(); // the field decides where the cursor goes
          onClosed?.();
        }}>
        <DialogHeader>
          <DialogTitle>{continuous ? "Scan codes one by one" : "Scan QR code or barcode"}</DialogTitle>
          <DialogDescription>
            Hold the code inside the box, about 10–20 cm from the camera, in good light.{continuous && " Move to the next code after the beep."}
          </DialogDescription>
        </DialogHeader>

        {status === "error" ? (
          <div role="alert" className="flex flex-col items-center gap-3 rounded-lg bg-muted p-6 text-center text-sm text-muted-foreground">
            <CameraOff className="size-8" />
            {message}
          </div>
        ) : (
          <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} className="size-full object-contain" muted playsInline />
            {/* aiming box = the area that is zoomed in on first */}
            <div className="pointer-events-none absolute inset-x-[20%] inset-y-[20%] rounded-lg border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            {status === "starting" ? (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white">
                <LoaderCircle className="size-4 animate-spin" /> Starting camera…
              </div>
            ) : (
              <div className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-1.5 text-xs text-white/90">
                <Camera className="size-3.5" /> Scanning…
              </div>
            )}
            {continuous && feedback && (
              <div
                role="status"
                className={`absolute inset-x-3 top-3 rounded-md px-3 py-1.5 text-center text-sm font-medium text-white ${feedback.kind === "ok" ? "bg-emerald-600/90" : "bg-destructive/90"}`}
              >
                {feedback.text}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} aria-label="Photo of the code" />
          <Button type="button" variant="outline" size="lg" disabled={photoBusy} onClick={() => fileRef.current?.click()}>
            {photoBusy ? <LoaderCircle className="animate-spin" /> : <ImageUp />}
            Take or choose a photo
          </Button>
          {photoError && <p className="text-center text-sm text-destructive">{photoError}</p>}
          {continuous && (
            <Button type="button" size="lg" onClick={() => onOpenChange(false)}>
              Done scanning
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
