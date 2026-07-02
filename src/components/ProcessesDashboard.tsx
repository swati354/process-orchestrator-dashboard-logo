import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Processes } from '@uipath/uipath-typescript/processes';
import type { ProcessGetResponse } from '@uipath/uipath-typescript/processes';
import type { PaginatedResponse } from '@uipath/uipath-typescript/core';
import { PackageType, TargetFramework } from '@uipath/uipath-typescript/processes';

const PAGE_SIZE = 25;

function frameworkLabel(f?: TargetFramework | string): string {
  if (!f) return '—';
  if (f === TargetFramework.Windows || f === 'Windows') return 'Windows';
  if (f === TargetFramework.Portable || f === 'Portable') return 'Cross-platform';
  if (f === TargetFramework.Legacy || f === 'Legacy') return 'Legacy';
  return String(f);
}

function packageTypeLabel(t?: PackageType | string): string {
  if (!t) return 'Process';
  const map: Record<string, string> = {
    [PackageType.Process]: 'Process',
    [PackageType.ProcessOrchestration]: 'Orchestration',
    [PackageType.WebApp]: 'Web App',
    [PackageType.Agent]: 'Agent',
    [PackageType.TestAutomationProcess]: 'Test',
    [PackageType.Api]: 'API',
    [PackageType.MCPServer]: 'MCP Server',
    [PackageType.BusinessRules]: 'Business Rules',
  };
  return map[t as string] ?? String(t);
}

function typeColor(t?: PackageType | string): string {
  const colors: Record<string, string> = {
    [PackageType.Process]: 'bg-green-100 text-green-800',
    [PackageType.ProcessOrchestration]: 'bg-blue-100 text-blue-800',
    [PackageType.Agent]: 'bg-purple-100 text-purple-800',
    [PackageType.WebApp]: 'bg-orange-100 text-orange-800',
    [PackageType.TestAutomationProcess]: 'bg-yellow-100 text-yellow-800',
    [PackageType.Api]: 'bg-cyan-100 text-cyan-800',
  };
  return colors[t as string] ?? 'bg-gray-100 text-gray-700';
}

function formatDate(d?: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function InitialAvatar({ name }: { name: string }) {
  const colors = [
    'bg-green-700', 'bg-blue-600', 'bg-purple-600',
    'bg-orange-600', 'bg-teal-600', 'bg-rose-600',
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${colors[idx]} text-sm font-bold text-white`}>
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function ProcessesDashboard() {
  const { sdk, logout } = useAuth();
  const processService = useMemo(() => new Processes(sdk), [sdk]);

  const [processes, setProcesses] = useState<ProcessGetResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [cursors, setCursors] = useState<Map<number, { value: string }>>(new Map());
  const [hasNextPage, setHasNextPage] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [activeNav, setActiveNav] = useState('processes');

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Reset pagination on filter/search change
  useEffect(() => {
    setCurrentPage(1);
    setCursors(new Map());
  }, [debouncedSearch, filterType]);

  const fetchPage = useCallback(async (page: number) => {
    setLoading(true);
    setError(null);
    try {
      const opts: Parameters<typeof processService.getAll>[0] = { pageSize: PAGE_SIZE };
      if (page > 1) {
        const cursor = cursors.get(page);
        if (cursor) opts.cursor = cursor;
      }
      if (debouncedSearch) {
        opts.filter = `contains(tolower(Name),'${debouncedSearch.toLowerCase().replace(/'/g, "''")}')`;
      }
      const result = await processService.getAll(opts) as PaginatedResponse<ProcessGetResponse>;
      let items = result.items ?? [];

      // Client-side filter by type if set
      if (filterType !== 'all') {
        items = items.filter(p => (p.packageType ?? PackageType.Process) === filterType);
      }

      setProcesses(items);
      if (typeof result.totalCount === 'number') setTotalCount(result.totalCount);
      setHasNextPage(result.hasNextPage ?? false);
      if (result.hasNextPage && result.nextCursor) {
        setCursors(prev => new Map(prev).set(page + 1, result.nextCursor!));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load processes');
    } finally {
      setLoading(false);
    }
  }, [processService, cursors, debouncedSearch, filterType]);

  useEffect(() => {
    fetchPage(currentPage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedSearch, filterType]);

  const goNext = () => { if (hasNextPage) setCurrentPage(p => p + 1); };
  const goPrev = () => { if (currentPage > 1) setCurrentPage(p => p - 1); };

  const totalShown = totalCount ?? processes.length;
  const rangeStart = (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, totalShown);

  // Stat cards derived from current page
  const latest = processes.reduce<ProcessGetResponse | null>((acc, p) => {
    if (!acc) return p;
    if (!p.lastModifiedTime) return acc;
    if (!acc.lastModifiedTime) return p;
    return new Date(p.lastModifiedTime) > new Date(acc.lastModifiedTime) ? p : acc;
  }, null);

  const upToDate = processes.filter(p => p.isLatestVersion).length;
  const outdated = processes.filter(p => !p.isLatestVersion).length;

  const typeCounts = processes.reduce<Record<string, number>>((acc, p) => {
    const t = p.packageType ?? PackageType.Process;
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});

  const navItems = [
    { id: 'processes', label: 'Processes', icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    )},
    { id: 'jobs', label: 'Jobs', icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    )},
    { id: 'queues', label: 'Queues', icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
    )},
    { id: 'assets', label: 'Assets', icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      </svg>
    )},
  ];

  const generalItems = [
    { id: 'settings', label: 'Settings', icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
      </svg>
    )},
    { id: 'help', label: 'Help', icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    )},
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 font-sans">
      {/* Sidebar */}
      <aside className="flex w-60 flex-shrink-0 flex-col justify-between overflow-y-auto bg-white py-6 shadow-sm">
        <div>
          {/* Logo */}
          <div className="mb-8 flex items-center gap-3 px-5">
            <img
              src="/logo.png"
              alt="Logo"
              className="h-10 w-10 rounded-xl object-contain"
            />
            <span className="text-lg font-bold text-gray-900">Orchestrator</span>
          </div>

          {/* Menu */}
          <div className="px-4">
            <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Menu</p>
            <nav className="flex flex-col gap-1">
              {navItems.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    activeNav === item.id
                      ? 'bg-green-900 text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          {/* General */}
          <div className="mt-8 px-4">
            <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">General</p>
            <nav className="flex flex-col gap-1">
              {generalItems.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Logout
              </button>
            </nav>
          </div>
        </div>

        {/* Promo card */}
        <div className="mx-4 mt-6 rounded-2xl bg-green-900 p-4 text-white">
          <p className="text-xs font-semibold leading-tight">Automate more with UiPath Studio</p>
          <p className="mt-1 text-[11px] text-green-200">Design and publish new processes</p>
          <button type="button" className="mt-3 w-full rounded-lg bg-green-700 py-1.5 text-xs font-semibold hover:bg-green-600 transition-colors">
            Open Studio
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-16 flex-shrink-0 items-center justify-between bg-white px-6 shadow-sm">
          <div className="relative w-72">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search processes…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-4 text-sm focus:border-green-700 focus:outline-none focus:ring-1 focus:ring-green-700"
            />
          </div>
          <div className="flex items-center gap-4">
            <button type="button" className="relative rounded-xl p-2 text-gray-500 hover:bg-gray-100">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-900 text-sm font-bold text-white">U</div>
              <div className="hidden md:block">
                <p className="text-sm font-semibold text-gray-900">UiPath User</p>
                <p className="text-xs text-gray-500">Orchestrator</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
          {/* Page title */}
          <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Processes</h1>
              <p className="text-sm text-gray-500">Browse and manage your Orchestrator process releases</p>
            </div>
            <button
              type="button"
              onClick={() => fetchPage(currentPage)}
              className="flex items-center gap-2 rounded-xl bg-green-900 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              Refresh
            </button>
          </div>

          {/* Stat cards */}
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="Total Processes"
              value={totalCount ?? processes.length}
              icon={<svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>}
              highlight
            />
            <StatCard
              label="Up to Date"
              value={upToDate}
              icon={<svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="20 6 9 17 4 12"/></svg>}
            />
            <StatCard
              label="Outdated"
              value={outdated}
              icon={<svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
            />
            <StatCard
              label="Latest Modified"
              value={latest ? latest.name.slice(0, 16) : '—'}
              icon={<svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
              small
            />
          </div>

          {/* Type filter tabs */}
          <div className="mb-4 flex flex-wrap gap-2">
            <TypeTab label="All" value="all" active={filterType} onClick={setFilterType} count={processes.length} />
            {Object.entries(typeCounts).map(([type, count]) => (
              <TypeTab key={type} label={packageTypeLabel(type)} value={type} active={filterType} onClick={setFilterType} count={count} />
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Table */}
          <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left">
                    <th className="px-5 py-3 font-semibold text-gray-500">Process</th>
                    <th className="px-4 py-3 font-semibold text-gray-500">Folder</th>
                    <th className="px-4 py-3 font-semibold text-gray-500">Type</th>
                    <th className="px-4 py-3 font-semibold text-gray-500">Version</th>
                    <th className="px-4 py-3 font-semibold text-gray-500">Framework</th>
                    <th className="px-4 py-3 font-semibold text-gray-500">Modified</th>
                    <th className="px-4 py-3 font-semibold text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="px-5 py-3"><div className="h-4 w-48 animate-pulse rounded bg-gray-100" /></td>
                        <td className="px-4 py-3"><div className="h-4 w-24 animate-pulse rounded bg-gray-100" /></td>
                        <td className="px-4 py-3"><div className="h-5 w-20 animate-pulse rounded-full bg-gray-100" /></td>
                        <td className="px-4 py-3"><div className="h-4 w-16 animate-pulse rounded bg-gray-100" /></td>
                        <td className="px-4 py-3"><div className="h-4 w-20 animate-pulse rounded bg-gray-100" /></td>
                        <td className="px-4 py-3"><div className="h-4 w-24 animate-pulse rounded bg-gray-100" /></td>
                        <td className="px-4 py-3"><div className="h-5 w-16 animate-pulse rounded-full bg-gray-100" /></td>
                      </tr>
                    ))
                  ) : processes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-16 text-center text-gray-400">
                        <div className="flex flex-col items-center gap-2">
                          <svg className="h-10 w-10 text-gray-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                          </svg>
                          <p className="text-sm">No processes found</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    processes.map(p => (
                      <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <InitialAvatar name={p.name} />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-gray-900 max-w-[200px]">{p.name}</p>
                              {p.description && (
                                <p className="truncate text-xs text-gray-400 max-w-[200px]">{p.description}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-[120px]">
                          <span className="truncate block">{p.folderName ?? '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${typeColor(p.packageType)}`}>
                            {packageTypeLabel(p.packageType)}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.packageVersion ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{frameworkLabel(p.targetFramework)}</td>
                        <td className="px-4 py-3 text-gray-500">{formatDate(p.lastModifiedTime)}</td>
                        <td className="px-4 py-3">
                          {p.isLatestVersion ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                              Latest
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                              Outdated
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
              <p className="text-xs text-gray-400">
                {loading ? 'Loading…' : `Showing ${rangeStart}–${rangeEnd} of ${totalShown}`}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1 || loading}
                  onClick={goPrev}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  ← Prev
                </button>
                <span className="rounded-lg bg-green-900 px-3 py-1.5 text-xs font-semibold text-white">
                  {currentPage}
                </span>
                <button
                  type="button"
                  disabled={!hasNextPage || loading}
                  onClick={goNext}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function StatCard({
  label, value, icon, highlight, small,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  highlight?: boolean;
  small?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-4 ${highlight ? 'bg-green-900 text-white' : 'bg-white text-gray-900'} shadow-sm`}>
      <div className="flex items-start justify-between">
        <p className={`text-xs font-semibold ${highlight ? 'text-green-200' : 'text-gray-500'}`}>{label}</p>
        <div className={`rounded-lg p-1.5 ${highlight ? 'bg-green-800' : 'bg-gray-100'} ${highlight ? 'text-green-200' : 'text-gray-500'}`}>
          {icon}
        </div>
      </div>
      <p className={`mt-2 font-bold ${small ? 'text-base truncate' : 'text-3xl'} ${highlight ? 'text-white' : 'text-gray-900'}`}>
        {value}
      </p>
      <p className={`mt-1 text-xs ${highlight ? 'text-green-300' : 'text-gray-400'}`}>
        {highlight ? 'This tenant' : 'Current page'}
      </p>
    </div>
  );
}

function TypeTab({
  label, value, active, onClick, count,
}: {
  label: string;
  value: string;
  active: string;
  onClick: (v: string) => void;
  count: number;
}) {
  const isActive = active === value;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
        isActive
          ? 'bg-green-900 text-white'
          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
      }`}
    >
      {label}
      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? 'bg-green-700 text-green-100' : 'bg-gray-100 text-gray-500'}`}>
        {count}
      </span>
    </button>
  );
}