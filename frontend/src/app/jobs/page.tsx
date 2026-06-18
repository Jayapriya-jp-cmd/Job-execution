'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Filter, Ban, Eye, RefreshCw } from 'lucide-react';

interface Job {
  id: string;
  name: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'RETRYING';
  progress: number;
  retryCount: number;
  createdAt: string;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/jobs');
      const data = await res.json();
      setJobs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleCancelJob = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this execution task?')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/jobs/${id}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('Job execution cancelled successfully.');
        fetchJobs();
      } else {
        alert(data.error || 'Failed to cancel job');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.name.toLowerCase().includes(searchTerm.toLowerCase()) || job.id.includes(searchTerm);
    const matchesStatus = statusFilter === 'ALL' || job.status === statusFilter;
    const matchesPriority = priorityFilter === 'ALL' || job.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System execution history</h1>
          <p className="text-slate-400 text-sm">Query and audit distributed process logs</p>
        </div>
        <button 
          onClick={fetchJobs}
          className="border border-slate-800 bg-slate-900/50 hover:bg-slate-800 p-2 rounded-lg transition"
        >
          <RefreshCw className="w-5 h-5 text-indigo-400" />
        </button>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border border-slate-900 bg-slate-950/40 rounded-xl">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-3 text-slate-500 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search by job name or unique ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/40 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="text-slate-500 w-4 h-4 flex-shrink-0" />
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-slate-900/40 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="RUNNING">RUNNING</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="FAILED">FAILED</option>
            <option value="RETRYING">RETRYING</option>
          </select>
        </div>

        <div>
          <select 
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="w-full bg-slate-900/40 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition"
          >
            <option value="ALL">All Priorities</option>
            <option value="HIGH">HIGH Priority</option>
            <option value="MEDIUM">MEDIUM Priority</option>
            <option value="LOW">LOW Priority</option>
          </select>
        </div>
      </div>

      {/* Main Jobs Table */}
      <div className="border border-slate-800 bg-slate-900/20 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="animate-spin text-indigo-500 w-4 h-4" /> Loading database indices...
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="p-12 text-center text-slate-600">No jobs match the selected filter query.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 font-semibold text-xs tracking-wider uppercase">
                  <th className="p-4">Job Details</th>
                  <th className="p-4">Priority</th>
                  <th className="p-4">Execution State</th>
                  <th className="p-4">Progress</th>
                  <th className="p-4">Retries</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-900/20 transition">
                    <td className="p-4 space-y-1">
                      <div className="font-semibold text-slate-200">{job.name}</div>
                      <div className="text-[10px] font-mono text-slate-500">{job.id}</div>
                    </td>
                    <td className="p-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        job.priority === 'HIGH' ? 'bg-red-950 text-red-400 border border-red-900' :
                        job.priority === 'MEDIUM' ? 'bg-blue-950 text-blue-400 border border-blue-900' :
                        'bg-slate-900 text-slate-400 border border-slate-800'
                      }`}>
                        {job.priority}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        job.status === 'COMPLETED' ? 'bg-emerald-950/80 text-emerald-400' :
                        job.status === 'RUNNING' ? 'bg-blue-950/80 text-blue-400 animate-pulse' :
                        job.status === 'FAILED' ? 'bg-red-950/80 text-red-400' :
                        job.status === 'RETRYING' ? 'bg-yellow-950/80 text-yellow-400' :
                        'bg-slate-900 text-slate-400'
                      }`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="p-4 w-1/5">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-slate-400 w-8">{job.progress}%</span>
                        <div className="w-full bg-slate-800 rounded-full h-1">
                          <div 
                            className="bg-indigo-500 h-1 rounded-full transition-all duration-500" 
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-mono text-xs text-slate-400">
                      {job.retryCount}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link 
                          href={`/jobs/${job.id}`}
                          className="p-1.5 border border-slate-800 bg-slate-950 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-indigo-400 transition"
                          title="Inspect metrics"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        
                        {(job.status === 'PENDING' || job.status === 'RUNNING' || job.status === 'RETRYING') && (
                          <button 
                            onClick={() => handleCancelJob(job.id)}
                            className="p-1.5 border border-red-950 bg-red-950/20 hover:bg-red-950/60 rounded-lg text-red-400 transition"
                            title="Kill task execution"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
