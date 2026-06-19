import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import { Clipboard, Crown, Link2, QrCode, RefreshCw, RotateCcw, Send, Sparkles, Users } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:4000" : window.location.origin);

function getRoomFromPath() {
  const match = window.location.pathname.match(/\/room\/([^/]+)/);
  return match?.[1] || "";
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

function App() {
  const [roomId, setRoomId] = useState(getRoomFromPath());
  const [nickname, setNickname] = useState(localStorage.getItem("ggc-toss-name") || "");
  const [joined, setJoined] = useState(false);
  const [participantId, setParticipantId] = useState("");
  const [room, setRoom] = useState(null);
  const [labels, setLabels] = useState({ head: "Heads", tail: "Tails" });
  const [isFlipping, setIsFlipping] = useState(false);
  const [toast, setToast] = useState("");
  const socketRef = useRef(null);
  const audioRef = useRef(null);

  const shareLink = useMemo(() => {
    if (!roomId) return "";
    return `${window.location.origin}/room/${roomId}`;
  }, [roomId]);

  const isAdmin = room?.adminId === participantId;

  useEffect(() => {
    audioRef.current = createCoinFlipSound;
  }, []);

  useEffect(() => {
    if (!room) return;
    setLabels(room.labels);
  }, [room?.labels?.head, room?.labels?.tail]);

  async function createRoom() {
    const response = await fetch(`${API_URL}/api/rooms`, { method: "POST" });
    const data = await response.json();
    window.history.pushState(null, "", `/room/${data.roomId}`);
    setRoomId(data.roomId);
    setToast("Room created. Share link is ready.");
  }

  function joinRoom(event) {
    event.preventDefault();
    if (!roomId.trim()) return;

    localStorage.setItem("ggc-toss-name", nickname);
    const socket = io(API_URL, { reconnection: true });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("room:join", { roomId, nickname }, (response) => {
        if (!response?.ok) {
          setToast(response?.message || "Could not join room.");
          return;
        }
        setParticipantId(response.participantId);
        setRoom(response.room);
        setJoined(true);
      });
    });

    socket.on("room:update", setRoom);

    socket.on("coin:flipped", () => {
      setIsFlipping(true);
      audioRef.current?.();
      window.setTimeout(() => setIsFlipping(false), 2400);
    });

    socket.on("disconnect", () => setToast("Reconnecting to room..."));
    socket.on("connect_error", () => setToast("Server is unavailable."));
  }

  function emitAdmin(eventName, payload = {}) {
    socketRef.current?.emit(eventName, payload, (response) => {
      if (!response?.ok) setToast(response?.message || "Action failed.");
    });
  }

  function updateLabels(event) {
    event.preventDefault();
    emitAdmin("labels:update", labels);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(shareLink);
    setToast("Link copied.");
  }

  const latest = room?.lastFlip;

  return (
    <main className="min-h-screen overflow-hidden bg-[#070812] text-slate-100">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.26),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,0.19),transparent_34%)]" />
      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <nav className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-teal-400 text-slate-950 shadow-glow">
              <Sparkles size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-normal">GGC TOSS</h1>
              <p className="text-xs text-slate-400">Realtime coin rooms</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-sm text-slate-300">
            <Users size={16} />
            <span>{room?.participants?.length || 0}</span>
          </div>
        </nav>

        {!joined ? (
          <Lobby
            roomId={roomId}
            setRoomId={setRoomId}
            nickname={nickname}
            setNickname={setNickname}
            createRoom={createRoom}
            joinRoom={joinRoom}
          />
        ) : (
          <div className="grid flex-1 gap-5 py-5 lg:grid-cols-[1fr_360px]">
            <section className="flex min-h-[620px] flex-col justify-between rounded-lg border border-white/10 bg-white/[0.045] p-4 shadow-2xl backdrop-blur sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase text-teal-200">Room {roomId}</p>
                  <h2 className="mt-1 text-3xl font-black sm:text-5xl">
                    {latest ? latest.result : "Ready to toss"}
                  </h2>
                </div>
                <button
                  className="icon-button"
                  type="button"
                  title="Copy invite link"
                  onClick={copyLink}
                >
                  <Clipboard size={18} />
                </button>
              </div>

              <Coin labels={room.labels} latest={latest} isFlipping={isFlipping} />

              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  disabled={!isAdmin || isFlipping}
                  onClick={() => emitAdmin("coin:flip")}
                  className="primary-action sm:col-span-2"
                  title={isAdmin ? "Flip coin" : "Only the admin can flip"}
                >
                  <RefreshCw size={19} />
                  <span>{isFlipping ? "Flipping..." : "Flip coin"}</span>
                </button>
                <button
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => emitAdmin("history:clear")}
                  className="secondary-action"
                  title="Clear history"
                >
                  <RotateCcw size={18} />
                  <span>Clear</span>
                </button>
              </div>
            </section>

            <aside className="grid gap-5">
              <Panel title="Admin Controls" icon={<Crown size={17} />}>
                <form className="grid gap-3" onSubmit={updateLabels}>
                  <label className="field-label">
                    Heads label
                    <input value={labels.head} onChange={(event) => setLabels({ ...labels, head: event.target.value })} disabled={!isAdmin} />
                  </label>
                  <label className="field-label">
                    Tails label
                    <input value={labels.tail} onChange={(event) => setLabels({ ...labels, tail: event.target.value })} disabled={!isAdmin} />
                  </label>
                  <button className="secondary-action" type="submit" disabled={!isAdmin}>
                    <Send size={17} />
                    <span>Update labels</span>
                  </button>
                </form>
              </Panel>

              <Panel title="Invite" icon={<Link2 size={17} />}>
                <div className="grid gap-3">
                  <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300 break-all">{shareLink}</div>
                  <div className="grid place-items-center rounded-lg bg-white p-3">
                    <QRCodeSVG value={shareLink} size={132} />
                  </div>
                  <a className="secondary-action justify-center" href={`https://wa.me/?text=${encodeURIComponent(`Join my GGC TOSS room: ${shareLink}`)}`} target="_blank" rel="noreferrer">
                    <QrCode size={17} />
                    <span>Share on WhatsApp</span>
                  </a>
                </div>
              </Panel>

              <Panel title="Participants" icon={<Users size={17} />}>
                <div className="grid gap-2">
                  {room.participants.map((participant) => (
                    <div className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2" key={participant.id}>
                      <span className="truncate text-sm">{participant.name}</span>
                      <div className="flex items-center gap-2">
                        {participant.isAdmin && <span className="rounded-full bg-teal-300 px-2 py-1 text-xs font-bold text-slate-950">Admin</span>}
                        {isAdmin && participant.id !== participantId && (
                          <button
                            className="tiny-button"
                            type="button"
                            onClick={() => emitAdmin("admin:transfer", { participantId: participant.id })}
                          >
                            Make admin
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="History" icon={<RefreshCw size={17} />}>
                <div className="max-h-72 overflow-auto pr-1">
                  {room.history.length === 0 ? (
                    <p className="text-sm text-slate-400">No flips yet.</p>
                  ) : (
                    room.history.map((entry) => (
                      <div className="mb-2 rounded-lg border border-white/10 bg-white/[0.035] p-3" key={entry.id}>
                        <div className="flex items-center justify-between gap-3">
                          <strong>{entry.result}</strong>
                          <span className="text-xs text-slate-400">{formatTime(entry.timestamp)}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">Flipped by {entry.flippedBy}</p>
                      </div>
                    ))
                  )}
                </div>
              </Panel>
            </aside>
          </div>
        )}

        {toast && (
          <button className="fixed bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/10 bg-slate-950 px-4 py-2 text-sm text-slate-200 shadow-glow" onClick={() => setToast("")}>
            {toast}
          </button>
        )}
      </section>
    </main>
  );
}

function Lobby({ roomId, setRoomId, nickname, setNickname, createRoom, joinRoom }) {
  return (
    <section className="grid flex-1 place-items-center py-10">
      <form onSubmit={joinRoom} className="w-full max-w-xl rounded-lg border border-white/10 bg-white/[0.045] p-5 shadow-2xl backdrop-blur sm:p-8">
        <div className="mb-8">
          <p className="mb-3 text-sm uppercase text-teal-200">No login needed</p>
          <h2 className="text-4xl font-black sm:text-6xl">Flip together, instantly.</h2>
          <p className="mt-4 text-slate-300">Create a room, share the link, customize both sides, and let everyone watch the GGC TOSS result land in real time.</p>
        </div>
        <div className="grid gap-3">
          <label className="field-label">
            Nickname
            <input placeholder="Enter Your Name" value={nickname} onChange={(event) => setNickname(event.target.value)} required/>
          </label>
          <label className="field-label">
            Room code
            <input placeholder="Create or paste a room code" value={roomId} onChange={(event) => setRoomId(event.target.value.trim())} required />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={createRoom} className="secondary-action justify-center">
              <Link2 size={18} />
              <span>Create room</span>
            </button>
            <button type="submit" className="primary-action justify-center">
              <Send size={18} />
              <span>Join room</span>
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

function Coin({ labels, latest, isFlipping }) {
  const faceText = latest?.result || labels.head;
  return (
    <div className="grid flex-1 place-items-center py-10">
      <div className={`coin ${isFlipping ? "coin-flipping" : ""}`} aria-live="polite">
        <div className="coin-face coin-front">
          <span>{faceText}</span>
        </div>
        <div className="coin-face coin-back">
          <span>{labels.tail}</span>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, icon, children }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.045] p-4 backdrop-blur">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase text-slate-300">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function createCoinFlipSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const context = new AudioContext();
  const master = context.createGain();
  master.gain.setValueAtTime(0.18, context.currentTime);
  master.connect(context.destination);

  const tickTimes = [0, 0.12, 0.25, 0.39, 0.54, 0.7, 0.87, 1.05, 1.24, 1.45, 1.68, 1.93, 2.16];

  tickTimes.forEach((offset, index) => {
    const duration = 0.055 + index * 0.003;
    const gain = context.createGain();
    const osc = context.createOscillator();
    const ring = context.createOscillator();
    const start = context.currentTime + offset;
    const pitch = 1260 - index * 42;

    osc.type = "triangle";
    osc.frequency.setValueAtTime(pitch, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(260, pitch * 0.48), start + duration);

    ring.type = "sine";
    ring.frequency.setValueAtTime(pitch * 1.9, start);
    ring.frequency.exponentialRampToValueAtTime(Math.max(420, pitch * 0.84), start + duration);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.24 - index * 0.011, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    ring.connect(gain);
    gain.connect(master);
    osc.start(start);
    ring.start(start);
    osc.stop(start + duration + 0.02);
    ring.stop(start + duration + 0.02);
  });

  const landing = context.createOscillator();
  const landingGain = context.createGain();
  const landingStart = context.currentTime + 2.25;
  landing.type = "square";
  landing.frequency.setValueAtTime(185, landingStart);
  landing.frequency.exponentialRampToValueAtTime(92, landingStart + 0.16);
  landingGain.gain.setValueAtTime(0.0001, landingStart);
  landingGain.gain.exponentialRampToValueAtTime(0.2, landingStart + 0.015);
  landingGain.gain.exponentialRampToValueAtTime(0.0001, landingStart + 0.28);
  landing.connect(landingGain);
  landingGain.connect(master);
  landing.start(landingStart);
  landing.stop(landingStart + 0.3);

  window.setTimeout(() => context.close(), 2900);
}

createRoot(document.getElementById("root")).render(<App />);
