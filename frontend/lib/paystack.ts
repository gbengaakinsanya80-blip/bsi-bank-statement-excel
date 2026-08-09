"use client";

export interface PaystackInitResponse {
  reference: string;
  trans?: string;
  transaction?: string;
  status?: string;
  message?: string;
}

export interface PaystackOptions {
  key: string;
  email: string;
  amount?: number;
  currency?: string;
  plan?: string;
  ref?: string;
  metadata?: Record<string, unknown>;
  callback?: (response: PaystackInitResponse) => void;
  onClose?: () => void;
}

interface PaystackPopInstance {
  setup(options: PaystackOptions): { openIframe: () => void };
}

declare global {
  interface Window {
    PaystackPop?: PaystackPopInstance;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadPaystackScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.PaystackPop) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://js.paystack.co/v1/inline.js";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Could not load Paystack. Check your connection."));
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export async function paystackCheckout(
  options: PaystackOptions,
): Promise<{ open: () => void }> {
  await loadPaystackScript();
  if (!window.PaystackPop) {
    throw new Error("Paystack is unavailable.");
  }
  const handler = window.PaystackPop.setup(options);
  return { open: () => handler.openIframe() };
}
