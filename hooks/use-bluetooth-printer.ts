"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  CPCLPrinter,
  type LabelData,
  type LabelConfig,
  type PrinterStatus,
  DEFAULT_LABEL_CONFIG,
} from "@/lib/bluetooth-printer";

export type { PrinterStatus, LabelData, LabelConfig };

export function useBluetoothPrinter() {
  const printerRef             = useRef<CPCLPrinter>(new CPCLPrinter());
  const [status, setStatus]    = useState<PrinterStatus>("disconnected");
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [labelConfig, setLabelConfig] = useState<LabelConfig>(DEFAULT_LABEL_CONFIG);

  const isSupported = typeof navigator !== "undefined" && "bluetooth" in navigator;

  // Carga la config guardada en el servidor al montar
  useEffect(() => {
    fetch("/api/admin/config-etiqueta")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.config) setLabelConfig(d.config); })
      .catch(() => {});
  }, []);

  const connect = useCallback(async () => {
    if (!isSupported) return;
    setStatus("connecting");
    try {
      const name = await printerRef.current.connect();
      setDeviceName(name);
      setStatus("connected");
    } catch {
      setStatus("error");
    }
  }, [isSupported]);

  const printLabel = useCallback(async (data: LabelData): Promise<void> => {
    setStatus("printing");
    try {
      const freshConfig = await fetch("/api/admin/config-etiqueta")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d?.config ?? labelConfig)
        .catch(() => labelConfig);
      await printerRef.current.printLabel(data, freshConfig);
      setStatus("connected");
    } catch (err) {
      setStatus("error");
      throw err;
    }
  }, [labelConfig]);

  const disconnect = useCallback(() => {
    printerRef.current.disconnect();
    setStatus("disconnected");
    setDeviceName(null);
  }, []);

  return { status, deviceName, isSupported, connect, printLabel, disconnect };
}
