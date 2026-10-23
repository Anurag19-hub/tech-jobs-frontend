# Tech Jobs Intelligence — React Frontend

A responsive React + Vite dashboard for the local FastAPI/Supabase Tech Jobs project.

## Requirements

- Node.js 20+ recommended
- FastAPI backend running on `http://127.0.0.1:8000`
- A jobs endpoint that returns the response shape seen in your project, such as `{ "page": 1, "page_size": 10, "total": 5, "jobs": [...] }`

## Run on Windows

Open PowerShell:

```powershell
cd D:\TechJobDashboard
mkdir frontend
```

Copy the contents of this `tech-jobs-frontend` folder into `D:\TechJobDashboard\frontend` (or use that folder directly), then run:

```powershell
cd D:\TechJobDashboard\frontend
npm install
npm run dev
```

Open the local URL Vite prints, usually `http://localhost:5173`.

## API paths

The frontend currently calls:

- `GET /jobs?page=1&page_size=100`
- `GET /health`

Vite proxies `/api/...` to `http://127.0.0.1:8000/...`, removing the `/api` prefix. This avoids local browser CORS configuration for development.

If your FastAPI routes use different paths, edit `JOBS_ENDPOINT` and `HEALTH_ENDPOINT` in `src/App.jsx`, and adjust `vite.config.js` if the endpoint prefix differs.

## Supported job title fields

The UI understands `job_title`, the misspelled `job_tile` currently shown in the API response, or `title`. Prefer standardizing the backend/database on `job_title` when convenient.

## Security

Do not add your Supabase secret/service-role key to this frontend. It belongs in the FastAPI backend `.env` only. This frontend calls FastAPI; it does not contact Supabase directly.
