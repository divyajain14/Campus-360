# Campus 360 frontend

React and Vite frontend for the Campus 360 backend.

## Run locally

1. Start the backend from the `backend` directory with `npm start`.
2. In another terminal, run:

   ```powershell
   cd frontend
   npm install
   Copy-Item .env.example .env
   npm run dev
   ```

3. Open the local URL printed by Vite.

`VITE_API_URL` in `.env` points to the backend and defaults to `http://localhost:5000`.
Set it to the deployed backend URL when hosting the frontend elsewhere.
