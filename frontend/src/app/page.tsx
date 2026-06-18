'use client';

import React, { useEffect, useState } from 'react';
import { socket } from '../utils/socket';
import { 
  Activity, 
  Cpu, 
  AlertTriangle, 
  CheckCircle, 
  Play, 
  Pause, 
  RefreshCw, 
  PlusCircle 
} from 'lucide-react';

interface Job {
  id: string;
  name: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'RETRYING';
  progress: number;
  retryCount: number;
}

interface Worker {
  id: string;
  name: string;
  status: 'ONLINE' | 'OFFLINE';
}

export default function Dashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [queuePaused, setQueuePaused] = useState(false);
  const [loading, setLoading] = useState(true);

  // Job form states
  const [jobName, setJobName] = useState('');
  const [jobPriority, setJobPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM');
  const [simulateFailure, setSimulateFailure] = useState(false);

  const fetchStats = async () => {
    try {
      const jobsRes = await fetch('http://localhost:5000/api/jobs');
      const jobsData = await jobsRes.json();
      setJobs(jobsData);

      const workersRes = await fetch('http://localhost:5000/api/workers');
      const workersData = await workersRes.json();
      setWorkers(workersData);
    } catch (error) {
      console.error("Failed to load dashboard statistics:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Socket.IO event handler for real-time updates
    socket.on('job:update', (data) => {
      setJobs(prevJobs => {
        const index = prevJobs.findIndex(j => j.id === data.id);
        if (index === -1) return [data, ...prevJobs];
        const copy = [...prevJobs];
        copy[index] = { ...copy[index], ...data };
        return copy;
      });
      // Periodically refresh workers since a job completing might change workers
      fetchStats();
    });

    return () => {
      socket.off('job:update');
    };
  }, []);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobName.trim()) return;

    try {
      const res = await fetch('http://localhost:5000/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: jobName,
          priority: jobPriority,
          payload: { simulateFailure },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setJobName('');
        setSimulateFailure(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleQueueControl = async (action: 'pause' | 'resume') => {
    try {
      const res = await fetch(`http://localhost:5000/api/queue/${action}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setQueuePaused(action === 'pause');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Aggregations
  const totalJobsCount = jobs.length;
  const runningJobsCount = jobs.filter(j => j.status === 'RUNNING').length;
  const failedJobsCount = jobs.filter(j => j.status === 'FAILED').length;
  const onlineWorkersCount = workers.filter(w => w.status === 'ONLINE').length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <RefreshCw className="animate-spin text-indigo-500 w-10 h-10" />
        <p className="text-slate-400">Bootstrapping scheduler console metrics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner Control Section */}
      <div className="flex items-center justify-between border border-slate-800 bg-slate-900/40 p-4 rounded-xl backdrop-blur">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            Queue Processor Status: 
            {queuePaused ? (
              <span className="text-red-400 font-mono text-sm px-2 py-0.5 rounded bg-red-950/50 border border-red-900">PAUSED</span>
            ) : (
              <span className="text-emerald-400 font-mono text-sm px-2 py-0.5 rounded bg-emerald-950/50 border border-emerald-900">ACTIVE</span>
            )}
          </h2>
          <p className="text-slate-400 text-xs mt-1">Control distributed execution pipelines globally</p>
        </div>
        <div className="flex items-center gap-3">
          {queuePaused ? (
            <button 
              onClick={() => handleQueueControl('resume')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm px-4 py-2 rounded-lg flex items-center gap-2 transition"
            >
              <Play className="w-4 h-4" /> Resume Scheduling
            </button>
          ) : (
            <button 
              onClick={() => handleQueueControl('pause')}
              className="bg-yellow-600 hover:bg-yellow-500 text-white font-medium text-sm px-4 py-2 rounded-lg flex items-center gap-2 transition"
            >
              <Pause className="w-4 h-4" /> Pause Scheduling
            </button>
          )}
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="border border-slate-800 bg-slate-900/20 p-6 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-slate-500 text-xs font-semibold tracking-wider uppercase">Total Jobs</span>
            <h3 className="text-3xl font-extrabold mt-1 text-indigo-100">{totalJobsCount}</h3>
          </div>
          <Activity className="text-indigo-400 w-8 h-8" />
        </div>

        <div className="border border-slate-800 bg-slate-900/20 p-6 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-slate-500 text-xs font-semibold tracking-wider uppercase">Running Jobs</span>
            <h3 className="text-3xl font-extrabold mt-1 text-blue-400">{runningJobsCount}</h3>
          </div>
          <RefreshCw className="text-blue-400 w-8 h-8 animate-spin" />
        </div>

        <div className="border border-slate-800 bg-slate-900/20 p-6 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-slate-500 text-xs font-semibold tracking-wider uppercase">Failed Jobs</span>
            <h3 className="text-3xl font-extrabold mt-1 text-red-400">{failedJobsCount}</h3>
          </div>
          <AlertTriangle className="text-red-400 w-8 h-8" />
        </div>

        <div className="border border-slate-800 bg-slate-900/20 p-6 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-slate-500 text-xs font-semibold tracking-wider uppercase">Workers Online</span>
            <h3 className="text-3xl font-extrabold mt-1 text-emerald-400">{onlineWorkersCount}</h3>
          </div>
          <Cpu className="text-emerald-400 w-8 h-8" />
        </div>
      </div>

      {/* Bottom Layout Split (Add Job Form / Active Jobs List) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Job Creator Panel */}
        <div className="border border-slate-800 bg-slate-900/10 p-6 rounded-xl space-y-6">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-indigo-400" /> Job Dispatcher
            </h3>
            <p className="text-slate-400 text-xs mt-1">Submit high-throughput simulation workflows into the clusters</p>
          </div>

          <form onSubmit={handleCreateJob} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase">Job Name / Routine</label>
              <input 
                type="text" 
                placeholder="e.g. Video Encoding, Log Compression"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase">Scheduler Priority</label>
              <select 
                value={jobPriority} 
                onChange={(e) => setJobPriority(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition"
              >
                <option value="HIGH">HIGH (First Out)</option>
                <option value="MEDIUM">MEDIUM (Standard)</option>
                <option value="LOW">LOW (Best Effort)</option>
              </select>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input 
                type="checkbox"
                id="fail-check"
                checked={simulateFailure}
                onChange={(e) => setSimulateFailure(e.target.checked)}
                className="w-4 h-4 accent-indigo-500 bg-slate-950 border-slate-800 rounded"
              />
              <label htmlFor="fail-check" className="text-xs font-medium text-slate-400 cursor-pointer">
                Simulate Payload Failure (Crash Execution)
              </label>
            </div>

            <button 
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm py-2.5 rounded-lg transition mt-4"
            >
              Push to Queue
            </button>
          </form>
        </div>

        {/* Live execution view */}
        <div className="border border-slate-800 bg-slate-900/10 p-6 rounded-xl lg:col-span-2 space-y-6">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" /> Active Job Monitor
            </h3>
            <p className="text-slate-400 text-xs mt-1">Real-time status tracking pipeline streams</p>
          </div>

          <div className="space-y-4 max-h-[360px] overflow-y-auto pr-2">
            {jobs.length === 0 ? (
              <p className="text-slate-600 text-sm py-8 text-center">No jobs submitted to queue yet.</p>
            ) : (
              jobs.slice(0, 10).map((job) => (
                <div key={job.id} className="border border-slate-900 bg-slate-950/60 p-4 rounded-lg flex items-center justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-200">{job.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        job.priority === 'HIGH' ? 'bg-red-950 text-red-400 border border-red-900' :
                        job.priority === 'MEDIUM' ? 'bg-blue-950 text-blue-400 border border-blue-900' :
                        'bg-slate-900 text-slate-400 border border-slate-800'
                      }`}>
                        {job.priority}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">ID: {job.id}</div>
                    
                    {/* Progress Bar */}
                    {job.status === 'RUNNING' && (
                      <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2">
                        <div 
                          className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500" 
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      job.status === 'COMPLETED' ? 'bg-emerald-950/80 text-emerald-400' :
                      job.status === 'RUNNING' ? 'bg-blue-950/80 text-blue-400 animate-pulse' :
                      job.status === 'FAILED' ? 'bg-red-950/80 text-red-400' :
                      job.status === 'RETRYING' ? 'bg-yellow-950/80 text-yellow-400' :
                      'bg-slate-900 text-slate-400'
                    }`}>
                      {job.status}
                    </span>
                    {job.retryCount > 0 && (
                      <span className="text-[10px] text-yellow-500 font-medium">Retries: {job.retryCount}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
