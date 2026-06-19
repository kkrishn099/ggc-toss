import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";
import { Server } from "socket.io";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGINS || CLIENT_ORIGIN)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();
const allowedOrigins = new Set([
  ...CLIENT_ORIGINS,
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`
]);
const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin ${origin} is not allowed by CORS.`));
  },
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions
});

const rooms = new Map();

function publicRoom(room) {
  return {
    id: room.id,
    labels: room.labels,
    participants: Array.from(room.participants.values()),
    history: room.history,
    lastFlip: room.lastFlip,
    adminId: room.adminId
  };
}

function ensureRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      adminId: null,
      labels: { head: "Heads", tail: "Tails" },
      participants: new Map(),
      history: [],
      lastFlip: null
    });
  }

  return rooms.get(roomId);
}

function emitRoom(roomId) {
  const room = rooms.get(roomId);
  if (room) {
    io.to(roomId).emit("room:update", publicRoom(room));
  }
}

app.post("/api/rooms", (_req, res) => {
  const roomId = nanoid(8);
  ensureRoom(roomId);
  res.status(201).json({ roomId });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});

app.use(express.static(path.join(__dirname, "../client/dist")));
app.use((_req, res) => {
  res.sendFile(path.join(__dirname, "../client/dist/index.html"));
});

io.on("connection", (socket) => {
  socket.on("room:join", ({ roomId, nickname }, ack) => {
    if (!roomId) {
      ack?.({ ok: false, message: "Missing room id." });
      return;
    }

    const room = ensureRoom(roomId);
    const participant = {
      id: socket.id,
      name: String(nickname || "Guest").trim().slice(0, 24) || "Guest",
      isAdmin: !room.adminId,
      joinedAt: new Date().toISOString()
    };

    if (!room.adminId) {
      room.adminId = socket.id;
    }

    room.participants.set(socket.id, participant);
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.name = participant.name;
    ack?.({ ok: true, participantId: socket.id, room: publicRoom(room) });
    emitRoom(roomId);
  });

  socket.on("labels:update", ({ head, tail }, ack) => {
    const room = rooms.get(socket.data.roomId);
    if (!room || room.adminId !== socket.id) {
      ack?.({ ok: false, message: "Only the admin can update labels." });
      return;
    }

    room.labels = {
      head: String(head || "Heads").trim().slice(0, 32) || "Heads",
      tail: String(tail || "Tails").trim().slice(0, 32) || "Tails"
    };
    ack?.({ ok: true });
    emitRoom(room.id);
  });

  socket.on("coin:flip", (_payload, ack) => {
    const room = rooms.get(socket.data.roomId);
    if (!room || room.adminId !== socket.id) {
      ack?.({ ok: false, message: "Only the admin can flip the coin." });
      return;
    }

    const side = Math.random() < 0.5 ? "head" : "tail";
    const entry = {
      id: nanoid(10),
      side,
      result: room.labels[side],
      flippedBy: socket.data.name || "Admin",
      timestamp: new Date().toISOString()
    };

    room.lastFlip = entry;
    room.history.unshift(entry);
    room.history = room.history.slice(0, 50);
    io.to(room.id).emit("coin:flipped", entry);
    ack?.({ ok: true, entry });
    emitRoom(room.id);
  });

  socket.on("history:clear", (_payload, ack) => {
    const room = rooms.get(socket.data.roomId);
    if (!room || room.adminId !== socket.id) {
      ack?.({ ok: false, message: "Only the admin can clear history." });
      return;
    }

    room.history = [];
    room.lastFlip = null;
    ack?.({ ok: true });
    emitRoom(room.id);
  });

  socket.on("admin:transfer", ({ participantId }, ack) => {
    const room = rooms.get(socket.data.roomId);
    if (!room || room.adminId !== socket.id || !room.participants.has(participantId)) {
      ack?.({ ok: false, message: "Admin transfer failed." });
      return;
    }

    room.adminId = participantId;
    for (const participant of room.participants.values()) {
      participant.isAdmin = participant.id === participantId;
    }
    ack?.({ ok: true });
    emitRoom(room.id);
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room) return;

    room.participants.delete(socket.id);

    if (room.adminId === socket.id) {
      const nextAdmin = room.participants.values().next().value;
      room.adminId = nextAdmin?.id || null;
      if (nextAdmin) nextAdmin.isAdmin = true;
    }

    if (room.participants.size === 0) {
      rooms.delete(roomId);
      return;
    }

    emitRoom(roomId);
  });
});

server.listen(PORT, () => {
  console.log(`Coin Toss server running on port ${PORT}`);
});
