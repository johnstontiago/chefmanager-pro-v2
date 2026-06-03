"use client";

import { useState, useRef, useCallback } from "react";
import { CPCLPrinter, type LabelData, type PrinterStatus } from "@/lib/bluetooth-printer";

export type { PrinterStatus, LabelData };

export function useBluetoothPrinter() {
  const printerRef             = useRef<CPCLPrinter>(new CPCLPrinter());
  const [status, setStatus]    = useState<PrinterStatus>("disconnected");
  const [deviceName, setDeviceName] = useState<string | null>(null);

  const isSupported = typeof navigator !== "undefined" && "bluetooth" in navigator;

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
      await printerRef.current.printLabel(data);
      setStatus("connected");
    } catch (err) {
      setStatus("error");
      throw err;
    }
  }, []);

  const disconnect = useCallback(() => {
    printerRef.current.disconnect();
    setStatus("disconnected");
    setDeviceName(null);
  }, []);

  return { status, deviceName, isSupported, connect, printLabel, disconnect };
}
