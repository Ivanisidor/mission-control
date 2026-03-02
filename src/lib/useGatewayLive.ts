"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Transport = "websocket" | "sse" | "polling" | "idle";

type GatewaySnapshot = {
  status: "online" | "offline" | "unknown";
  updatedAt: number;
  payload?: unknown;
  transport: Transport;
  error?: string;
};

const DEFAULTS = {
  wsUrl: process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_WS_URL,
  sseUrl: process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_SSE_URL,
  pollUrl: process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_POLL_URL ?? "http://127.0.0.1:3100/status",
  pollMs: Number(process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_POLL_MS ?? 15000),
};

export function useGatewayLive() {
  const [snapshot, setSnapshot] = useState<GatewaySnapshot>({
    status: "unknown",
    updatedAt: Date.now(),
    transport: "idle",
  });

  const wsRef = useRef<WebSocket | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopAll = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const mark = useCallback((next: Partial<GatewaySnapshot>) => {
    setSnapshot((prev) => ({ ...prev, ...next, updatedAt: Date.now() }));
  }, []);

  const pollOnce = useCallback(async () => {
    try {
      const res = await fetch(DEFAULTS.pollUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`poll failed (${res.status})`);
      const json = await res.json().catch(() => ({}));
      mark({ status: "online", payload: json, transport: "polling", error: undefined });
    } catch (error) {
      mark({ status: "offline", transport: "polling", error: error instanceof Error ? error.message : String(error) });
    } finally {
      if (!document.hidden) {
        pollRef.current = setTimeout(() => {
          void pollOnce();
        }, DEFAULTS.pollMs);
      }
    }
  }, [mark]);

  const startPolling = useCallback(() => {
    stopAll();
    void pollOnce();
  }, [pollOnce, stopAll]);

  const startSSE = useCallback(() => {
    if (!DEFAULTS.sseUrl) {
      startPolling();
      return;
    }
    stopAll();
    try {
      const es = new EventSource(DEFAULTS.sseUrl);
      sseRef.current = es;
      mark({ transport: "sse" });

      es.onmessage = (evt) => {
        let data: unknown = evt.data;
        try {
          data = JSON.parse(evt.data);
        } catch {
          // keep raw payload
        }
        mark({ status: "online", payload: data, transport: "sse", error: undefined });
      };

      es.onerror = () => {
        mark({ status: "offline", transport: "sse", error: "SSE disconnected, falling back to polling" });
        es.close();
        sseRef.current = null;
        startPolling();
      };
    } catch (error) {
      mark({ status: "offline", transport: "sse", error: error instanceof Error ? error.message : String(error) });
      startPolling();
    }
  }, [mark, startPolling, stopAll]);

  const startWebSocket = useCallback(() => {
    if (!DEFAULTS.wsUrl) {
      startSSE();
      return;
    }
    stopAll();
    try {
      const ws = new WebSocket(DEFAULTS.wsUrl);
      wsRef.current = ws;
      mark({ transport: "websocket" });

      ws.onopen = () => mark({ status: "online", transport: "websocket", error: undefined });
      ws.onmessage = (evt) => {
        let data: unknown = evt.data;
        try {
          data = JSON.parse(String(evt.data));
        } catch {
          // keep raw payload
        }
        mark({ status: "online", payload: data, transport: "websocket", error: undefined });
      };
      ws.onerror = () => mark({ status: "offline", transport: "websocket", error: "WebSocket error, retrying via SSE/polling" });
      ws.onclose = () => {
        wsRef.current = null;
        startSSE();
      };
    } catch (error) {
      mark({ status: "offline", transport: "websocket", error: error instanceof Error ? error.message : String(error) });
      startSSE();
    }
  }, [mark, startSSE, stopAll]);

  useEffect(() => {
    if (document.hidden) return;
    startWebSocket();

    const onVisibility = () => {
      if (document.hidden) {
        stopAll();
        mark({ transport: "idle" });
      } else {
        startWebSocket();
      }
    };

    const onOnline = () => {
      startWebSocket();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      stopAll();
    };
  }, [mark, startWebSocket, stopAll]);

  return useMemo(() => snapshot, [snapshot]);
}
