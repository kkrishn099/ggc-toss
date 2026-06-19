# GGC TOSS

A modern realtime room-based coin toss app. Users can create a room, share the link, join without accounts, and watch admin-controlled flips update instantly through Socket.io.

## Features

- Room creation with shareable `/room/:roomId` links
- Optional nickname entry, no login required
- First participant becomes admin
- Admin-only coin flip, label editing, history clearing, and admin transfer
- Realtime participant list, flip result, label, and history updates
- In-memory room and history storage
- WhatsApp share link and QR code
- Dark responsive UI with animated 3D coin and flip sound

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`, create a room, then open the copied room link in another tab or device on the same network.

## Production Build

```bash
npm install
npm run build
npm start
```

The Express server serves the built frontend from `client/dist` and listens on `PORT` or `4000`.

## Environment Variables

```bash
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
VITE_API_URL=http://localhost:4000
```

For a single Render deployment, set `CLIENT_ORIGIN` to your Render app URL before start. For separate Vercel + Render deployment, set `VITE_API_URL` in Vercel to the Render backend URL and set `CLIENT_ORIGIN` in Render to the Vercel frontend URL.

## Deploy To Render

1. Push this project to GitHub.
2. Create a Render Web Service.
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Add environment variables:
   - `PORT`: Render provides this automatically.
   - `CLIENT_ORIGIN`: your Render public URL, for example `https://ggc-toss.onrender.com`.

## Deploy Frontend To Vercel And Backend To Render

1. Backend on Render:
   - Build command: `npm install`
   - Start command: `npm start`
   - Set `CLIENT_ORIGIN=https://your-vercel-app.vercel.app`
2. Frontend on Vercel:
   - Root directory: `client`
   - Build command: `npm install --prefix .. && npm run build --prefix ..`
   - Output directory: `dist`
   - Set `VITE_API_URL=https://your-render-service.onrender.com`

## Notes

Room data is stored in memory. It is fast and simple, but data clears when the server restarts. To persist rooms and history, replace the `rooms` map in `server/index.js` with MongoDB, Firebase, or Redis.
