import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle2, AlertTriangle, Server, Database, RefreshCw, ShieldCheck } from 'lucide-react';
import { checkBackendHealth, API_BASE_URL } from '../services/api';

export default function Phase1Health() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);

  const fetchHealth = async () => {
    setLoading(true);
    const result = await checkBackendHealth();
    setHealth(result);
    setLastChecked(new Date().toLocaleTimeString());
    setLoading(false);
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-slate-800/80 backdrop-blur border border-slate-700 rounded-xl p-8 shadow-2xl">
        <div className="flex items-center justify-between pb-6 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-indigo-400">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">The Daily Voice</h1>
              <p className="text-xs text-slate-400 font-mono">Phase 1: Environment & Connectivity Check</p>
            </div>
          </div>
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="flex items-center space-x-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-md text-sm font-medium transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Checking...' : 'Re-check'}</span>
          </button>
        </div>

        {/* Backend Endpoint Info */}
        <div className="mt-6 p-4 bg-slate-950/60 rounded-lg border border-slate-800 font-mono text-xs text-slate-300">
          <div className="flex justify-between items-center py-1">
            <span className="text-slate-500">API BASE URL:</span>
            <span className="text-indigo-300">{API_BASE_URL}</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-slate-500">Target Endpoint:</span>
            <span className="text-indigo-300">GET /api/health</span>
          </div>
          {lastChecked && (
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">Last Verified:</span>
              <span>{lastChecked}</span>
            </div>
          )}
        </div>

        {/* Diagnostic Results */}
        <div className="mt-6 space-y-4">
          {health ? (
            health.ok ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-emerald-950/30 border border-emerald-800/50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="text-sm font-medium text-emerald-200">Backend Connected</p>
                      <p className="text-xs text-emerald-400/80">
                        HTTP {health.status} OK • {health.latencyMs}ms latency
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono uppercase bg-emerald-900/40 text-emerald-300 px-2.5 py-1 rounded">
                    {health.data?.status || 'Active'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Database Diagnostic */}
                  <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-lg">
                    <div className="flex items-center space-x-2 text-slate-400 mb-2">
                      <Database className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-medium uppercase tracking-wider">Database</span>
                    </div>
                    <p className="text-sm font-semibold capitalize text-slate-200">
                      {health.data?.checks?.database?.status || 'Unknown'}
                    </p>
                    {health.data?.checks?.database?.error && (
                      <p className="text-xs text-amber-400 mt-1 font-mono break-words">
                        {health.data.checks.database.error}
                      </p>
                    )}
                  </div>

                  {/* Supabase Status */}
                  <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-lg">
                    <div className="flex items-center space-x-2 text-slate-400 mb-2">
                      <ShieldCheck className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-medium uppercase tracking-wider">Supabase Auth/Storage</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-200">
                      {health.data?.checks?.supabase?.configured ? 'Configured' : 'Awaiting Credentials'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 truncate">
                      {health.data?.checks?.supabase?.url || 'See .env.example'}
                    </p>
                  </div>
                </div>

                {/* Raw response payload */}
                <div className="mt-4">
                  <p className="text-xs text-slate-400 mb-1 font-medium">Backend JSON Response:</p>
                  <pre className="p-3 bg-slate-950 rounded border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto">
                    {JSON.stringify(health.data, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-rose-950/30 border border-rose-800/50 rounded-lg">
                <div className="flex items-center space-x-3 mb-2">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                  <div>
                    <p className="text-sm font-medium text-rose-200">Backend Communication Error</p>
                    <p className="text-xs text-rose-400/80">Could not reach {API_BASE_URL}/api/health</p>
                  </div>
                </div>
                <div className="text-xs font-mono bg-slate-950/80 p-3 rounded text-rose-300 border border-rose-900/40">
                  {health.error}
                </div>
                <p className="text-xs text-slate-400 mt-3">
                  Ensure the Flask backend is running on {API_BASE_URL}.
                </p>
              </div>
            )
          ) : (
            <div className="text-center py-8 text-slate-400 text-sm">
              <Server className="w-8 h-8 mx-auto mb-2 opacity-40 animate-pulse" />
              Initializing connectivity probe...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
