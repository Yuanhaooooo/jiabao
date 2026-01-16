import React, { useState, useRef, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

const BUCKET = "voice-archive";

interface VoiceMessage {
  id: string;
  url: string; // 播放用
  duration: number;
  timestamp: number;
  node: string;
  file_path?: string; // Supabase Storage path
}

function genId() {
  return "MSG-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function getPlayableUrl(filePath: string): Promise<string> {
  if (!supabase) throw new Error("Supabase not configured");

  // ✅ 如果 bucket 是 Public，直接用 public url
  const pub = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  if (pub?.data?.publicUrl) return pub.data.publicUrl;

  // ✅ 如果 bucket 是 Private，走 signed url
  const signed = await supabase.storage.from(BUCKET).createSignedUrl(filePath, 60 * 60);
  if (signed.error || !signed.data?.signedUrl) {
    throw signed.error ?? new Error("Failed to create signed url");
  }
  return signed.data.signedUrl;
}

const VoiceArchive: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [vocalLevel, setVocalLevel] = useState(0);
  const [syncStatus, setSyncStatus] = useState<"IDLE" | "SYNCING" | "ERROR">("IDLE");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // ============ 拉取云端列表 ============
  useEffect(() => {
    if (!isOpen) return;

    let interval: number | null = null;

    const loadMessages = async () => {
      setSyncStatus("SYNCING");
      try {
        if (!supabase) {
          // 没配置 supabase 的情况下，给你一个明显提示
          setMessages([]);
          setSyncStatus("ERROR");
          return;
        }

        const { data, error } = await supabase
          .from("voice_messages")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;

        const withUrls: VoiceMessage[] = await Promise.all(
          (data ?? []).map(async (row: any) => {
            const url = await getPlayableUrl(row.file_path);
            return {
              id: row.id,
              file_path: row.file_path,
              url,
              duration: row.duration,
              timestamp: new Date(row.created_at).getTime(),
              node: row.node,
            };
          })
        );

        setMessages(withUrls);
        setSyncStatus("IDLE");
      } catch (err) {
        console.error("Sync failed:", err);
        setSyncStatus("ERROR");
      }
    };

    loadMessages();
    interval = window.setInterval(loadMessages, 15000);

    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [isOpen]);

  // ============ 录音 ============
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyzer = audioCtx.createAnalyser();
      source.connect(analyzer);

      const update = () => {
        const data = new Uint8Array(analyzer.frequencyBinCount);
        analyzer.getByteFrequencyData(data);
        setVocalLevel(data.reduce((a, b) => a + b, 0) / data.length);
        animationFrameRef.current = requestAnimationFrame(update);
      };
      update();

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);

      mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });

          const id = genId();
          const node = "NODE-" + Math.floor(Math.random() * 999);
          const duration = recordingTime;
          const ts = Date.now();

          if (!supabase) throw new Error("Supabase not configured");

          setSyncStatus("SYNCING");

          // 1) 上传到 Storage
          const filePath = `zjb/${ts}-${id}.webm`;
          const up = await supabase.storage.from(BUCKET).upload(filePath, blob, {
            contentType: "audio/webm",
            upsert: false,
          });
          if (up.error) throw up.error;

          // 2) 写入 DB 元数据
          const ins = await supabase.from("voice_messages").insert({
            id,
            file_path: filePath,
            duration,
            node,
          });
          if (ins.error) throw ins.error;

          // 3) 本地立刻可播放
          const url = await getPlayableUrl(filePath);
          const newMessage: VoiceMessage = {
            id,
            file_path: filePath,
            url,
            duration,
            timestamp: ts,
            node,
          };

          setMessages((p) => [newMessage, ...p]);
          setRecordingTime(0);
          setSyncStatus("IDLE");
        } catch (err) {
          console.error("Upload failed:", err);
          setSyncStatus("ERROR");
        } finally {
          stream.getTracks().forEach((t) => t.stop());
          audioCtx.close();
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      timerIntervalRef.current = window.setInterval(() => setRecordingTime((p) => p + 1), 1000);
    } catch (err) {
      console.error("Recording failed:", err);
      setSyncStatus("ERROR");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerIntervalRef.current) window.clearInterval(timerIntervalRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  };

  // ============ 播放 ============
  const playMessage = (msg: VoiceMessage) => {
    if (playingId === msg.id) {
      audioPlayerRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.src = msg.url;
      audioPlayerRef.current.play();
      setPlayingId(msg.id);
      audioPlayerRef.current.onended = () => setPlayingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-1/2 right-12 -translate-y-1/2 w-85 h-[580px] border border-yellow-500/30 bg-black/95 backdrop-blur-3xl p-6 flex flex-col z-50 shadow-[0_0_80px_rgba(0,0,0,0.9)] animate-in fade-in slide-in-from-right-10 duration-500">
      <div className="flex justify-between items-center mb-4 pb-4 border-b border-yellow-500/20">
        <div className="flex flex-col">
          <h3 className="text-yellow-500 text-[10px] uppercase font-bold font-mono tracking-widest">
            全域同步音频存档
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                syncStatus === "SYNCING"
                  ? "bg-blue-500 animate-pulse"
                  : syncStatus === "ERROR"
                  ? "bg-red-500"
                  : "bg-green-500"
              }`}
            ></div>
            <span className="text-[6px] text-white/40 uppercase tracking-tighter">
              {syncStatus === "SYNCING"
                ? "同步云端中..."
                : syncStatus === "ERROR"
                ? "同步连接失败 / 未配置Supabase"
                : "云端已就绪"}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-yellow-500/40 hover:text-yellow-500 text-[10px] transition-colors"
        >
          [关闭终端]
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-6 scrollbar-thin scrollbar-thumb-yellow-500/20">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-20 italic">
            <p className="text-[9px] text-white tracking-widest">暂无云端存档数据</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`group p-4 border transition-all duration-300 ${
                playingId === msg.id
                  ? "border-yellow-500/60 bg-yellow-500/10"
                  : "border-yellow-500/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <div className="flex justify-between text-[7px] text-yellow-500/60 font-mono mb-3">
                <span className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-yellow-500/40 rounded-full"></div>
                  {msg.id}
                </span>
                <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => playMessage(msg)}
                  className={`flex-1 py-2.5 border border-yellow-500/30 text-yellow-500 text-[9px] uppercase transition-all flex items-center justify-center gap-2 ${
                    playingId === msg.id ? "bg-yellow-500/20" : "hover:border-yellow-500/60"
                  }`}
                >
                  {playingId === msg.id ? (
                    <>
                      <div className="flex gap-1">
                        <div className="w-0.5 h-2 bg-yellow-500 animate-bounce"></div>
                        <div className="w-0.5 h-2 bg-yellow-500 animate-bounce delay-75"></div>
                        <div className="w-0.5 h-2 bg-yellow-500 animate-bounce delay-150"></div>
                      </div>
                      正在解码...
                    </>
                  ) : (
                    <>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      提取声纹存档
                    </>
                  )}
                </button>
                <div className="ml-4 text-right">
                  <div className="text-white text-[10px] font-mono leading-none">{msg.duration}S</div>
                  <div className="text-white/20 text-[6px] font-mono mt-1">{msg.node}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-yellow-500/20 pt-6 flex flex-col items-center gap-4 bg-black/40 p-4 -mx-6 -mb-6">
        <div className="flex flex-col items-center gap-1 mb-2">
          <p className="text-[10px] text-yellow-500 font-mono font-bold tracking-widest">
            {isRecording ? `REC_LIVE: ${recordingTime}S` : "采集新的全域留言"}
          </p>
          <p className="text-[7px] text-white/20 uppercase">声音将上传至拾七核心存档库</p>
        </div>

        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`relative w-20 h-20 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
            isRecording
              ? "border-red-600 scale-110 shadow-[0_0_30px_rgba(220,38,38,0.4)]"
              : "border-yellow-500/30 hover:border-yellow-500"
          }`}
        >
          {isRecording && (
            <div className="absolute inset-0 rounded-full border-2 border-red-600 animate-ping opacity-20"></div>
          )}
          <div
            className={`transition-all duration-500 ${
              isRecording ? "w-8 h-8 rounded-sm bg-red-600" : "w-10 h-10 rounded-full bg-yellow-500"
            }`}
            style={{ transform: isRecording ? `scale(${1 + vocalLevel / 80})` : "none" }}
          ></div>
        </button>

        <div className="w-full flex justify-between px-2 mt-2 opacity-30 text-[6px] text-white font-mono uppercase">
          <span>Lat: 24ms</span>
          <span>Prot: WebRTC/SSL</span>
          <span>Enc: WEBM</span>
        </div>
      </div>

      <audio ref={audioPlayerRef} className="hidden" />
    </div>
  );
};

export default VoiceArchive;
