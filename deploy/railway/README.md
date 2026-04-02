# Railway Deployment Notes

This repo deploys two Railway services from one monorepo:

- `frontend`
- `backend`

## Public URLs

- Frontend: `https://frontend-production-062e.up.railway.app`
- Backend: `https://backend-production-8727.up.railway.app`

## Config-As-Code Files

- Frontend service config: [`/railway.json`](/Users/lawrencekeener/Desktop/gauntlet/labs/week7/chatbridge/railway.json)
- Backend service config: [`/server/railway.json`](/Users/lawrencekeener/Desktop/gauntlet/labs/week7/chatbridge/server/railway.json)

## Railway Service Settings

Set these once in the Railway dashboard so service settings match the committed config:

### Frontend

- Source root: repo root
- Config file path: `/railway.json`
- Uses the root [`Dockerfile`](/Users/lawrencekeener/Desktop/gauntlet/labs/week7/chatbridge/Dockerfile)

Required variables:

- `PLUGIN_BACKEND_URL=https://backend-production-8727.up.railway.app`
- `OPENWEATHER_API_KEY=<value>`

### Backend

- Root directory: `/server`
- Config file path: `/server/railway.json`
- Service variable: `RAILWAY_DOCKERFILE_PATH=server/Dockerfile`

Required variables:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`

## Audit

Run the deployment audit from the repo root:

```bash
bash scripts/audit_railway.sh
```

The audit checks:

- frontend root URL returns `200`
- frontend ChatBridge login route returns `200`
- backend health route returns `200`
