# Salary estimator — frontend (React + TypeScript + Vite)

## Run
1. Backend (from the backend folder):  `uvicorn main:app --reload`   → http://127.0.0.1:8000
2. Frontend (this folder):  `npm install` then `npm run dev`          → http://localhost:5173

Dev requests go to `/api/*` and Vite proxies them to port 8000, so no CORS setup is needed.

## Production
Set `VITE_API_URL` (see `.env.example`) and add CORS to `main.py`:

    from fastapi.middleware.cors import CORSMiddleware
    app.add_middleware(CORSMiddleware, allow_origins=["https://your-site.com"],
                       allow_methods=["*"], allow_headers=["*"])

## Regenerating dropdown options
`src/options.ts` was generated from `employee_salary_dataset_10000.csv`.
