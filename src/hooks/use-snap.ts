"use client";
import { useCallback, useEffect, useState } from "react";

type SnapCallbacks = {
  onSuccess?: (r: unknown) => void;
  onPending?: (r: unknown) => void;
  onError?: (r: unknown) => void;
  onClose?: () => void;
};
declare global {
  interface Window {
    snap?: { pay: (token: string, cb: SnapCallbacks) => void; hide?: () => void };
  }
}

/** Memuat snap.js Midtrans sekali saja */
export function useSnap(clientKey: string, isProduction: boolean, enabled: boolean) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled || !clientKey) return;
    if (window.snap) {
      setReady(true);
      return;
    }
    const src = isProduction ? "https://app.midtrans.com/snap/snap.js" : "https://app.sandbox.midtrans.com/snap/snap.js";
    let script = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = src;
      script.setAttribute("data-client-key", clientKey);
      script.async = true;
      document.body.appendChild(script);
    }
    const onLoad = () => setReady(true);
    script.addEventListener("load", onLoad);
    return () => script?.removeEventListener("load", onLoad);
  }, [clientKey, isProduction, enabled]);

  const pay = useCallback((token: string, cb: SnapCallbacks) => {
    if (!window.snap) return false;
    window.snap.pay(token, cb);
    return true;
  }, []);
  return { ready, pay };
}
