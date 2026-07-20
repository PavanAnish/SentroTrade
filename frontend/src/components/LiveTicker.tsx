'use client';

import React, { useEffect, useState, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface TickerData {
  [ticker: string]: { price: number; sentiment?: string };
}

interface PricePoint {
  time: string;
  price: number;
}

interface HistoryData {
  [ticker: string]: PricePoint[];
}

export default function LiveTicker() {
  const [data, setData] = useState<TickerData>({});
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [history, setHistory] = useState<HistoryData>({});
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const previousData = useRef<TickerData>({});

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimeout: number;

    const connect = () => {
      setStatus('connecting');
      // In production this should be an env variable, but for this demo hardcoded is ok
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws/stream';
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'LIVE_UPDATE' && message.data) {
            setData((prev) => {
              previousData.current = prev;
              return message.data;
            });
            
            setHistory((prevHistory) => {
              const newHistory = { ...prevHistory };
              const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              
              for (const ticker of Object.keys(message.data)) {
                if (!newHistory[ticker]) {
                  newHistory[ticker] = [];
                }
                newHistory[ticker] = [...newHistory[ticker], { time: now, price: message.data[ticker].price }].slice(-50);
              }
              return newHistory;
            });
          }
        } catch (e) {
          console.error("Failed to parse websocket message", e);
        }
      };

      ws.onclose = () => {
        setStatus('disconnected');
        // Attempt to reconnect after 5 seconds
        reconnectTimeout = window.setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        // ws.onclose will be called right after
        setStatus('disconnected');
      };
    };

    connect();

    return () => {
      window.clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, []);

  return (
    <div className="flex flex-col mb-6 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-emerald-500 animate-pulse' : status === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'}`} />
        <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">Live Market Stream</span>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        {Object.entries(data).length > 0 ? (
          Object.entries(data).map(([ticker, info]) => {
            const prevPrice = previousData.current[ticker]?.price;
            const isUp = prevPrice ? info.price > prevPrice : false;
            const isDown = prevPrice ? info.price < prevPrice : false;
            
            return (
              <div 
                key={ticker} 
                onClick={() => setSelectedTicker(ticker)}
                className="flex flex-col items-center justify-center p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 cursor-pointer hover:bg-slate-700 hover:scale-105 transition-all duration-200"
              >
                <span className="text-slate-300 font-bold">{ticker}</span>
                <span className={`text-xl font-mono transition-colors duration-300 ${isUp ? 'text-emerald-400' : isDown ? 'text-red-400' : 'text-slate-100'}`}>
                  ${info.price.toFixed(2)}
                </span>
              </div>
            );
          })
        ) : (
          <div className="col-span-3 text-center text-slate-500 italic py-2">
            Waiting for live data...
          </div>
        )}
      </div>

      {selectedTicker && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200" 
          onClick={() => setSelectedTicker(null)}
        >
          <div 
            className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-3xl shadow-2xl relative" 
            onClick={e => e.stopPropagation()}
          >
            <button 
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              onClick={() => setSelectedTicker(null)}
            >
              ✕
            </button>
            <div className="flex items-center gap-3 mb-6">
              <h3 className="text-2xl font-bold text-white">{selectedTicker}</h3>
              <div className="px-2 py-1 rounded bg-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider border border-indigo-500/30">
                Live Chart
              </div>
            </div>
            <div className="h-72 w-full">
              {history[selectedTicker] && history[selectedTicker].length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history[selectedTicker]} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <XAxis 
                      dataKey="time" 
                      stroke="#64748b" 
                      fontSize={11} 
                      tickMargin={12} 
                      minTickGap={20} 
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      stroke="#64748b" 
                      fontSize={11} 
                      domain={['auto', 'auto']} 
                      tickFormatter={(value) => `$${value.toFixed(2)}`} 
                      width={60}
                      axisLine={false}
                      tickLine={false}
                      tickMargin={12}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ color: '#38bdf8', fontWeight: 600 }}
                      labelStyle={{ color: '#94a3b8', marginBottom: '0.25rem' }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="price" 
                      stroke="#38bdf8" 
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6, fill: '#38bdf8', stroke: '#0f172a', strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-3">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <p>Collecting tick data...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
