'use client';

import React, { useEffect, useState } from 'react';
import { Cpu, RefreshCw, Circle, CheckCircle, Clock } from 'lucide-react';

interface ActiveExecution {
  id: string;
  job: {
    id: string;
    name: string;
    priority: string;
  };
}

interface Worker {
  id: string;
  name: string;
  status: 'ONLINE' | 'OFFLINE';
  lastHeartbeat: string;
  executions: ActiveExecution[];
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWorkers = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/workers');
      const data = await res.json();
      setWorkers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
    const interval = setInterval(fetchWorkers, 4000); // Poll nodes heartbeat sync status
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cluster Nodes Registry</h1>
          <p className="text-slate-400 text-sm">Monitor available active worker nodes and task loads</p>
        </div>
        <button 
          onClick={fetchWorkers}
          className="border border-slate-800 bg-slate-900/50 hover:bg-slate-800 p-2 rounded-lg transition"
        >
          <RefreshCw className="w-5 h-5 text-indigo-400" />
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500 flex items-center justify-center gap-2">
          <RefreshCw className="animate-spin text-indigo-500 w-4 h-4" /> Polling cluster nodes...
        </div>
      ) : workers.length === 0 ? (
        <div className="p-12 text-center text-slate-600 border border-slate-800 bg-slate-900/10 rounded-xl">
          No worker instances registered. Run a local worker node to connect to the queue system.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workers.map((worker) => (
            <div 
              key={worker.id}
              className={`border p-6 rounded-xl space-y-5 transition ${
                worker.status === 'ONLINE' 
                  ? 'border-slate-800 bg-slate-900/20' 
                  : 'border-slate-950 bg-slate-950/40 opacity-60'
              }`}
            >
              {/* Node Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className={`w-5 h-5 ${worker.status === 'ONLINE' ? 'text-indigo-400' : 'text-slate-600'}`} />
                  <span className="font-bold text-slate-200">{worker.name}</span>
                </div>
                
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1.5 ${
                  worker.status === 'ONLINE' 
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' 
                    : 'bg-red-950 text-red-400 border border-red-900'
                }`}>
                  <Circle className="w-1.5 h-1.5 fill-current animate-pulse" />
                  {worker.status}
                </span>
              </div>

              {/* Heartbeat Sync Status */}
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Last check-in: {new Date(worker.lastHeartbeat).toLocaleTimeString()}</span>
              </div>

              {/* Current Assignments */}
              <div className="border-t border-slate-800/60 pt-4 space-y-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Running Load</span>
                {worker.executions.length === 0 ? (
                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> IDLE (Awaiting Assignment)
                  </div>
                ) : (
                  worker.executions.map((exec) => (
                    <div 
                      key={exec.id}
                      className="border border-slate-900 bg-slate-950/60 p-2.5 rounded-lg text-xs space-y-1"
                    >
                      <div className="font-semibold text-slate-300">{exec.job.name}</div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>ID: {exec.job.id.substring(0, 8)}...</span>
                        <span className="bg-indigo-950 text-indigo-400 px-1.5 py-0.5 rounded font-bold">
                          {exec.job.priority}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
