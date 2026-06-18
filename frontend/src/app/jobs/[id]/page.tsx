'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Terminal, 
  Cpu, 
  Calendar, 
  RotateCcw, 
  Clock, 
  ServerCrash 
} from 'lucide-react';

interface Execution {
  id: string;
  workerId: string | null;
  worker: { name: string } | null;
  startedAt: string;
  completedAt: string | null;
  status: string;
  executionTime: number | null;
  errorMessage: string | null;
  retryAttempt: number;
}

interface Log {
  id: string;
  message: string;
  timestamp: string;
}

interface Job {
  id: string;
  name: string;
  priority: string;
  status: string;
  progress: number;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
  executions: Execution[];
  logs: Log[];
}

export default function JobDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchJobDetails = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/jobs/${id}`);
      if (res.ok) {
        const data = await res.json();
        setJob(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobDetails();
    const interval = setInterval(fetchJobDetails, 3000); // Poll details for live logs
    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-500">
        Loading task properties...
      </div>
    );
  }

  if (!job) {
    return (
      <div className="py-24 text-center space-y-4">
        <p className="text-red-400">Job execution history not found.</p>
        <Link href="/jobs" className="text-indigo-400 text-sm hover:underline">
          Return to jobs page
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header breadcrumb */}
      <div>
        <Link href="/jobs" className="text-slate-400 hover:text-indigo-400 text-xs flex items-center gap-1 transition mb-3">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to history audit log
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{job.name}</h1>
            <p className="text-slate-500 font-mono text-xs mt-1">UUID: {job.id}</p>
          </div>
          <span className={`text-sm font-semibold px-3.5 py-1 rounded-full ${
            job.status === 'COMPLETED' ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-900' :
            job.status === 'RUNNING' ? 'bg-blue-950/80 text-blue-400 animate-pulse border border-blue-900' :
            job.status === 'FAILED' ? 'bg-red-950/80 text-red-400 border border-red-900' :
            job.status === 'RETRYING' ? 'bg-yellow-950/80 text-yellow-400 border border-yellow-900' :
            'bg-slate-900 text-slate-400 border border-slate-800'
          }`}>
            {job.status}
          </span>
        </div>
      </div>

      {/* Grid Meta Information Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Profile Card */}
        <div className="border border-slate-900 bg-slate-950/50 p-6 rounded-xl space-y-4 col-span-2">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Job Parameters</h2>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 block">Queue Priority</span>
              <span className="font-semibold text-slate-200">{job.priority}</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-slate-500 block">Exponential Retries Configuration</span>
              <span className="font-semibold text-slate-200">{job.retryCount} / {job.maxRetries} Max</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-slate-500 block">Submitted At</span>
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> 
                {new Date(job.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-slate-500 block">Last Activity Timestamp</span>
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {new Date(job.updatedAt).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Status Breakdown Bar */}
        <div className="border border-slate-900 bg-slate-950/50 p-6 rounded-xl space-y-3">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Job Completion</h2>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-extrabold text-indigo-400">{job.progress}%</span>
            <span className="text-xs text-slate-500">Execution Progress</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2">
            <div 
              className="bg-indigo-500 h-2 rounded-full transition-all duration-500" 
              style={{ width: `${job.progress}%` }}
            />
          </div>
        </div>

      </div>

      {/* Timeline Logs and Execution History Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Terminal logs list */}
        <div className="border border-slate-800 bg-slate-900/10 p-6 rounded-xl space-y-4">
          <h2 className="text-md font-bold flex items-center gap-2 text-indigo-300">
            <Terminal className="w-5 h-5" /> Timeline log timeline
          </h2>
          
          <div className="bg-black/80 rounded-lg p-4 font-mono text-xs space-y-3 max-h-[350px] overflow-y-auto border border-slate-900">
            {job.logs.length === 0 ? (
              <span className="text-slate-600">No output logs emitted by runner pipeline.</span>
            ) : (
              job.logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 text-slate-300">
                  <span className="text-slate-500 flex-shrink-0 select-none">
                    [{new Date(log.timestamp).toLocaleTimeString()}]
                  </span>
                  <span className="break-all">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Execution node metrics list */}
        <div className="border border-slate-800 bg-slate-900/10 p-6 rounded-xl space-y-4">
          <h2 className="text-md font-bold flex items-center gap-2 text-indigo-300">
            <Cpu className="w-5 h-5" /> Cluster assignments history
          </h2>

          <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
            {job.executions.length === 0 ? (
              <span className="text-slate-600 text-sm">No scheduling records registered yet.</span>
            ) : (
              job.executions.map((exec) => (
                <div 
                  key={exec.id} 
                  className="border border-slate-900 bg-slate-950 p-4 rounded-lg space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold text-slate-300">
                        {exec.worker?.name || 'Unassigned (Scheduler Queue)'}
                      </span>
                      {exec.retryAttempt > 0 && (
                        <span className="bg-yellow-950 text-yellow-400 border border-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                          <RotateCcw className="w-3 h-3" /> Retry Attempt #{exec.retryAttempt}
                        </span>
                      )}
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                      exec.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-400' :
                      exec.status === 'RUNNING' ? 'bg-blue-950 text-blue-400 animate-pulse' :
                      'bg-red-950 text-red-400'
                    }`}>
                      {exec.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                    <div>Started: {new Date(exec.startedAt).toLocaleTimeString()}</div>
                    {exec.completedAt && (
                      <div>Ended: {new Date(exec.completedAt).toLocaleTimeString()}</div>
                    )}
                    {exec.executionTime !== null && (
                      <div className="col-span-2 text-indigo-400">
                        Duration: {(exec.executionTime / 1000).toFixed(2)}s
                      </div>
                    )}
                  </div>

                  {exec.errorMessage && (
                    <div className="border border-red-950 bg-red-950/20 text-red-400 text-xs p-2.5 rounded-lg flex items-start gap-2">
                      <ServerCrash className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{exec.errorMessage}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
