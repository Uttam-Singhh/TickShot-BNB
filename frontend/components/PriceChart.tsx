"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, CandlestickSeries, CandlestickData, Time } from "lightweight-charts";
import { BINANCE_KLINE_URL, BINANCE_WS_URL } from "@/lib/constants";

export function PriceChart({ onPriceUpdate }: { onPriceUpdate?: (price: number) => void }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [prevPrice, setPrevPrice] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: "#6b7280",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.02)" },
        horzLines: { color: "rgba(255,255,255,0.02)" },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: "rgba(240,185,11,0.4)", width: 1, labelBackgroundColor: "#F0B90B" },
        horzLine: { color: "rgba(240,185,11,0.4)", width: 1, labelBackgroundColor: "#F0B90B" },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: "rgba(255,255,255,0.06)",
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.06)",
      },
      width: chartContainerRef.current.clientWidth,
      height: 420,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#16a34a",
      borderDownColor: "#dc2626",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

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
          const p = candles[candles.length - 1].close;
          setPrice(p);
          onPriceUpdate?.(p);
        }
        chart.timeScale().fitContent();
      })
      .catch(console.error);

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
      const newPrice = candle.close;
      setPrevPrice((prev) => prev);
      setPrice((prev) => {
        setPrevPrice(prev);
        return newPrice;
      });
      setFlash(true);
      setTimeout(() => setFlash(false), 400);
      onPriceUpdate?.(newPrice);
    };

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

  const priceUp = price && prevPrice ? price >= prevPrice : true;
  const priceChange = price && prevPrice ? ((price - prevPrice) / prevPrice * 100) : 0;

  return (
    <div className="glass-panel p-0 overflow-hidden">
      {/* Live price banner */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-live-dot" />
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Live</span>
          </div>
          <span className="text-sm font-medium text-gray-300">BNB / USD</span>
        </div>
        {price && (
          <div className="flex items-center gap-3">
            <span
              className={`text-2xl font-mono font-black tracking-tight transition-all ${
                flash ? "animate-price-flash" : ""
              } ${priceUp ? "text-green-400" : "text-red-400"}`}
            >
              ${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {priceChange !== 0 && (
              <span className={`text-xs font-mono font-bold px-2 py-1 rounded-md ${
                priceUp
                  ? "text-green-400 bg-green-500/10"
                  : "text-red-400 bg-red-500/10"
              }`}>
                {priceUp ? "+" : ""}{priceChange.toFixed(3)}%
              </span>
            )}
          </div>
        )}
      </div>
      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
}
