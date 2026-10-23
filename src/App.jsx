import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownUp,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  ExternalLink,
  Filter,
  Globe2,
  LayoutDashboard,
  MapPin,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Wifi,
  X,
} from 'lucide-react';

const PAGE_SIZE = 100;
const JOBS_ENDPOINT = '/api/jobs';
const HEALTH_ENDPOINT = '/api/health';

function normalizeJob(job, index) {
  return {
    id: job.id ?? job.job_id ?? `${job.apply_url ?? 'job'}-${index}`,
    title: job.job_title ?? job.job_tile ?? job.title ?? 'Untitled role',
    company: job.company ?? job.company_name ?? 'Company not listed',
    category: job.category ?? 'Technology',
    location: job.location ?? job.candidate_required_location ?? 'Location not specified',
    type: job.job_type ?? job.type ?? 'Not specified',
    publishedAt: job.published_at ?? job.publication_date ?? null,
    salary: job.salary ?? '',
    applyUrl: job.apply_url ?? job.url ?? '',
    description: job.description_text ?? job.description ?? '',
  };
}

function formatDate(value) {
  if (!value) return 'Date not listed';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not listed';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(date);
}

function shortDescription(text, limit = 190) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'No description was provided for this listing.';
  return clean.length > limit ? `${clean.slice(0, limit).trimEnd()}…` : clean;
}

function titleInitials(title) {
  return String(title || 'T')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

function StatCard({ icon: Icon, label, value, detail, tone = 'blue' }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}><Icon size={19} /></div>
      <div className="stat-copy">
        <span className="stat-label">{label}</span>
        <strong>{value}</strong>
        <span className="stat-detail">{detail}</span>
      </div>
    </div>
  );
}

function JobCard({ job, onOpen }) {
  return (
    <article className="job-card">
      <div className="job-card-top">
        <div className="company-avatar" aria-hidden="true">{titleInitials(job.company)}</div>
        <div className="job-heading">
          <div className="company-name">{job.company}</div>
          <h3>{job.title}</h3>
        </div>
        <button className="icon-button open-details" aria-label={`View details for ${job.title}`} onClick={() => onOpen(job)}>
          <ArrowUpRight size={18} />
        </button>
      </div>
      <div className="job-tags">
        <span className="tag"><MapPin size={13} />{job.location || 'Location not specified'}</span>
        <span className="tag"><BriefcaseBusiness size={13} />{formatJobType(job.type)}</span>
        {job.category && <span className="tag category-tag">{job.category}</span>}
      </div>
      <p className="job-description">{shortDescription(job.description)}</p>
      <div className="job-card-bottom">
        <div className="job-meta">
          {job.salary ? <span className="salary">{job.salary}</span> : <span className="muted">Salary not listed</span>}
          <span className="posted"><CalendarDays size={13} />{formatDate(job.publishedAt)}</span>
        </div>
        {job.applyUrl ? (
          <a className="apply-link" href={job.applyUrl} target="_blank" rel="noreferrer">
            Apply <ExternalLink size={14} />
          </a>
        ) : (
          <button className="apply-link disabled" disabled>No link</button>
        )}
      </div>
    </article>
  );
}

function formatJobType(type) {
  const value = String(type || 'Not specified').replace(/[_-]+/g, ' ');
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function JobDetailsModal({ job, onClose }) {
  useEffect(() => {
    if (!job) return undefined;
    const handler = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [job, onClose]);

  if (!job) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="details-modal" role="dialog" aria-modal="true" aria-labelledby="details-title">
        <div className="modal-head">
          <div className="company-avatar large">{titleInitials(job.company)}</div>
          <button className="icon-button" onClick={onClose} aria-label="Close job details"><X size={19} /></button>
        </div>
        <div className="company-name">{job.company}</div>
        <h2 id="details-title">{job.title}</h2>
        <div className="job-tags modal-tags">
          <span className="tag"><MapPin size={13} />{job.location}</span>
          <span className="tag"><BriefcaseBusiness size={13} />{formatJobType(job.type)}</span>
          <span className="tag"><CalendarDays size={13} />{formatDate(job.publishedAt)}</span>
        </div>
        {job.salary && <div className="modal-salary">{job.salary}</div>}
        <h4>Job description</h4>
        <p className="full-description">{job.description || 'No description was provided for this listing.'}</p>
        {job.applyUrl && <a className="primary-button modal-apply" href={job.applyUrl} target="_blank" rel="noreferrer">Open application <ExternalLink size={15} /></a>}
      </section>
    </div>
  );
}

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [backendHealth, setBackendHealth] = useState('checking');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [selectedJob, setSelectedJob] = useState(null);
  const [visibleCount, setVisibleCount] = useState(9);

  const fetchJobs = useCallback(async ({ isRefresh = false } = {}) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const response = await fetch(`${JOBS_ENDPOINT}?page=1&page_size=${PAGE_SIZE}`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(`Jobs API returned ${response.status}${message ? `: ${message.slice(0, 180)}` : ''}`);
      }
      const payload = await response.json();
      const rawJobs = Array.isArray(payload) ? payload : (payload.jobs ?? payload.items ?? payload.data ?? []);
      if (!Array.isArray(rawJobs)) throw new Error('The API response did not contain a jobs array.');
      setJobs(rawJobs.map(normalizeJob));
      setTotal(Number(payload.total ?? rawJobs.length));
    } catch (err) {
      setError(`${err.message}. Check that FastAPI is running and that the endpoint is GET /jobs. If your endpoint uses a different path, update JOBS_ENDPOINT in src/App.jsx and the proxy in vite.config.js if needed.`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    fetch(HEALTH_ENDPOINT)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Health check failed')))
      .then((payload) => setBackendHealth(payload.database === 'connected' || payload.status === 'healthy' ? 'connected' : 'online'))
      .catch(() => setBackendHealth('unknown'));
  }, [fetchJobs]);

  const locations = useMemo(() => [...new Set(jobs.map((job) => job.location).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [jobs]);
  const jobTypes = useMemo(() => [...new Set(jobs.map((job) => job.type).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [jobs]);

  const filteredJobs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const result = jobs.filter((job) => {
      const matchesQuery = !normalizedQuery || [job.title, job.company, job.category, job.location, job.description]
        .some((value) => String(value ?? '').toLowerCase().includes(normalizedQuery));
      const matchesType = typeFilter === 'all' || job.type === typeFilter;
      const matchesLocation = locationFilter === 'all' || job.location === locationFilter;
      return matchesQuery && matchesType && matchesLocation;
    });
    result.sort((a, b) => {
      if (sort === 'oldest') return new Date(a.publishedAt || 0) - new Date(b.publishedAt || 0);
      if (sort === 'company') return a.company.localeCompare(b.company);
      return new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0);
    });
    return result;
  }, [jobs, query, typeFilter, locationFilter, sort]);

  useEffect(() => { setVisibleCount(9); }, [query, typeFilter, locationFilter, sort]);

  const clearFilters = () => {
    setQuery('');
    setTypeFilter('all');
    setLocationFilter('all');
    setSort('newest');
  };

  const onCloseModal = useCallback(() => setSelectedJob(null), []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><Activity size={23} strokeWidth={2.5} /></div>
          <div><strong>JobPulse</strong><span>INTELLIGENCE</span></div>
        </div>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <a className="nav-item active" href="#dashboard"><LayoutDashboard size={18} /><span>Dashboard</span></a>
          <a className="nav-item" href="#job-listings"><BriefcaseBusiness size={18} /><span>Job listings</span><span className="nav-count">{total}</span></a>
        </nav>
        <div className="sidebar-bottom">
          <div className="connection-card">
            <div className="connection-row"><span className={`status-dot ${backendHealth === 'connected' ? 'online' : backendHealth === 'checking' ? 'checking' : 'offline'}`} /><span>Backend status</span></div>
            <strong>{backendHealth === 'connected' ? 'Connected' : backendHealth === 'checking' ? 'Checking…' : backendHealth === 'online' ? 'Online' : 'Unavailable'}</strong>
            <span className="connection-caption">FastAPI · Supabase</span>
          </div>
          <div className="sidebar-footer"><span>LOCAL DEVELOPMENT</span><span className="local-pill"><span className="status-dot online" /> Local API</span></div>
        </div>
      </aside>

      <main id="dashboard" className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>Dashboard</strong></div>
          <div className="topbar-right">
            <div className="live-status"><span className="status-dot online" />Data workspace</div>
            <button className="refresh-button" onClick={() => fetchJobs({ isRefresh: true })} disabled={refreshing}>
              <RefreshCw size={15} className={refreshing ? 'spin' : ''} />{refreshing ? 'Refreshing' : 'Refresh data'}
            </button>
          </div>
        </header>

        <section className="welcome-section">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" />TECH JOB MONITORING</div>
            <h1>Find your next <span>opportunity.</span></h1>
            <p className="welcome-description">A clear view of remote tech opportunities, collected in one place.</p>
          </div>
          <div className="welcome-decoration" aria-hidden="true"><div className="orb orb-one"/><div className="orb orb-two"/><div className="orb-ring"/><div className="orb-dot dot-one"/><div className="orb-dot dot-two"/></div>
        </section>

        <section className="stats-grid" aria-label="Job statistics">
          <StatCard icon={BriefcaseBusiness} label="JOBS IN DATABASE" value={loading ? '—' : total.toLocaleString('en-IN')} detail="Records returned by your API" tone="blue" />
          <StatCard icon={Building2} label="COMPANIES" value={loading ? '—' : new Set(jobs.map((job) => job.company)).size.toLocaleString('en-IN')} detail="Across current listings" tone="violet" />
          <StatCard icon={Globe2} label="LOCATIONS" value={loading ? '—' : locations.length.toLocaleString('en-IN')} detail="Candidate locations" tone="teal" />
          <StatCard icon={Wifi} label="API CONNECTION" value={backendHealth === 'connected' ? 'Online' : backendHealth === 'checking' ? 'Checking' : 'Check'} detail="FastAPI connection status" tone="amber" />
        </section>

        <section id="job-listings" className="listings-section">
          <div className="section-heading">
            <div><div className="section-kicker">OPPORTUNITIES</div><h2>Latest job listings <span className="heading-count">{loading ? '' : filteredJobs.length}</span></h2><p>Search, filter and explore jobs collected by your workflow.</p></div>
            <div className="source-chip"><span className="source-dot" /> Live from your backend</div>
          </div>

          <div className="filter-panel">
            <label className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, company, skills…" aria-label="Search jobs" />{query && <button className="clear-search" onClick={() => setQuery('')} aria-label="Clear search"><X size={15} /></button>}<kbd>⌘ K</kbd></label>
            <div className="filter-controls">
              <label className="select-wrap"><Filter size={15} /><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filter job type"><option value="all">All job types</option>{jobTypes.map((type) => <option key={type} value={type}>{formatJobType(type)}</option>)}</select><ChevronDown size={14} /></label>
              <label className="select-wrap location-select"><MapPin size={15} /><select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} aria-label="Filter location"><option value="all">All locations</option>{locations.map((location) => <option key={location} value={location}>{location}</option>)}</select><ChevronDown size={14} /></label>
              <label className="select-wrap sort-select"><ArrowDownUp size={15} /><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort jobs"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="company">Company A–Z</option></select><ChevronDown size={14} /></label>
              {(query || typeFilter !== 'all' || locationFilter !== 'all' || sort !== 'newest') && <button className="reset-button" onClick={clearFilters}><X size={14} /> Reset</button>}
            </div>
          </div>

          {error && <div className="error-banner"><CircleAlert size={19} /><div><strong>Couldn't load job listings</strong><p>{error}</p></div><button className="retry-button" onClick={() => fetchJobs()}><RefreshCw size={14} /> Retry</button></div>}

          {loading ? (
            <div className="job-grid" aria-label="Loading jobs">{Array.from({ length: 6 }).map((_, index) => <div className="skeleton-card" key={index}><div className="skeleton-line avatar-line"/><div className="skeleton-line title-line"/><div className="skeleton-line body-line"/><div className="skeleton-line body-line short"/><div className="skeleton-line bottom-line"/></div>)}</div>
          ) : !error && filteredJobs.length === 0 ? (
            <div className="empty-state"><div className="empty-icon"><Search size={24} /></div><h3>No jobs found</h3><p>{jobs.length ? 'Try another search or clear the filters.' : 'Your backend returned no job records yet.'}</p><button className="secondary-button" onClick={clearFilters}>Clear filters</button></div>
          ) : !error ? (
            <>
              <div className="job-grid">
                {filteredJobs.slice(0, visibleCount).map((job, index) => <JobCard key={`${job.id}-${index}`} job={job} onOpen={setSelectedJob} />)}
              </div>
              <div className="results-footer"><span>Showing <strong>{Math.min(visibleCount, filteredJobs.length)}</strong> of <strong>{filteredJobs.length}</strong> matching jobs</span>{visibleCount < filteredJobs.length && <button className="secondary-button" onClick={() => setVisibleCount((count) => count + 9)}>Load more jobs <ArrowUpRight size={15} /></button>}</div>
            </>
          ) : null}
        </section>
        <footer className="page-footer"><span>JobPulse <span className="footer-separator">·</span> Tech Jobs Intelligence</span><span><Clock3 size={13} /> Data updates when your n8n workflow runs</span></footer>
      </main>
      <JobDetailsModal job={selectedJob} onClose={onCloseModal} />
    </div>
  );
}
