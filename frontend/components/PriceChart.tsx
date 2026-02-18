"use client";

import { useEffect, useRef } from "react";
import { createChart, CandlestickSeries, CandlestickData, Time } from "lightweight-charts";
import { BINANCE_KLINE_URL, BINANCE_WS_URL } from "@/lib/constants";

export function PriceChart({ onPriceUpdate }: { onPriceUpdate?: (price: number) => void }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: {
        vertLine: { color: "rgba(240,185,11,0.3)" },
        horzLine: { color: "rgba(240,185,11,0.3)" },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: "rgba(255,255,255,0.1)",
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.1)",
      },
      width: chartContainerRef.current.clientWidth,
      height: 350,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    // Load initial klines
    fetch(BINANCE_KLINE_URL)
      .then((res) => res.json())
      .then((data: unknown[]) => {
        const candles: CandlestickData<Time>[] = (data as string[][]).map((k) => ({
          time: (Number(k[0]) / 1000) as Time,
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
        }));
        series.setData(candles);
        if (candles.length > 0) {
          onPriceUpdate?.(candles[candles.length - 1].close);
        }
        chart.timeScale().fitContent();
      })
      .catch(console.error);

    // WebSocket for real-time updates
    const ws = new WebSocket(BINANCE_WS_URL);
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      const k = msg.k;
      if (!k) return;

      const candle: CandlestickData<Time> = {
        time: (k.t / 1000) as Time,
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
      };
      series.update(candle);
      onPriceUpdate?.(candle.close);
    };

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      ws.close();
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="glass-panel p-4">
      <h2 className="text-sm font-medium text-gray-400 mb-3">BNB/USD - 1m</h2>
      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
}
