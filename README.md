# Campus 360

Campus 360 helps students discover campus events, register for them, and manage their schedule. Admins can create, edit, and delete events.

## Project layout

- `backend/` - Express API, MongoDB models, authentication, and event/registration routes.
- `frontend/` - React + Vite web app.

## Run locally

1. In `backend/`, copy `.env.example` to `.env`, then set `MONGO_URI` and a private `JWT_SECRET`.
2. Start the API:

   ```powershell
   cd backend
   npm install
   npm start
   ```

3. In a second terminal, start the frontend:

   ```powershell
   cd frontend
   npm install
   Copy-Item .env.example .env
   npm run dev
   ```

4. Open the local URL printed by Vite.

## Deployment configuration

- Backend environment: set `MONGO_URI`, `JWT_SECRET`, the host-provided `PORT`, and `CORS_ORIGINS` to the exact frontend origin(s), comma-separated.
- Allow the backend host's outbound IP in MongoDB Atlas Network Access.
- Build the frontend with `npm run build` from `frontend/` and set `VITE_API_URL` to the deployed backend base URL before building.
- Keep both `.env` files private; only the `.env.example` templates belong in Git.

New accounts are students by default. Provision trusted admin accounts directly in the database; never accept an admin role from public sign-up.
