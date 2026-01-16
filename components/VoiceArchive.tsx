// components/VoiceArchive.tsx
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

const BUCKET = "voice-archive";
const TABLE = "voice_messages";

interface VoiceMessage {
  id: string;
  url: string;
  duration: number;
  timestamp: number;
  node: string;
  file_path?: string;
}

type SyncStatus = "IDLE" | "SYNCING" | "ERROR";

const VoiceArchive: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [vocalLevel, setVocalLevel] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("IDLE");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // 用于关闭时清理音频/流
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // ---------- 工具：生成一个短 ID ----------
  const genId = () =>
    "MSG-" + Math.random().toString(36).slice(2, 8).toUpperCase();

  // ---------- 工具：把 Storage 路径变成可播放 URL ----------
  // 你 bucket 设为 Public 时：getPublicUrl 即可
  // 若你之后改成 Private，需要改成 createSignedUrl（我也给了注释版本）
  const toPlayableUrl = (filePath: string) => {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    return data.publicUrl;
  };

  // ---------- 拉取消息列表 ----------
  const loadMessages = async () => {
    setSyncStatus("SYNCING");
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const list: VoiceMessage[] = (data ?? []).map((row: any) => {
        const url = toPlayableUrl(row.file_path);
        return {
          id: row.id,
          url,
          duration: row.duration,
          timestamp: new Date(row.created_at).getTime(),
          node: row.node ?? "NODE-0",
          file_path: row.file_path,
        };
      });

      setMessages(list);
      setSyncStatus("IDLE");
    } catch (err) {
      console.error("Load messages failed:", err);
      setSyncStatus("ERROR");
    }
  };

  // 打开面板时加载 + 轮询刷新
  useEffect(() => {
    if (!isOpen) return;

    loadMessages();
    const interval = window.setInterval(loadMessages, 15000);

    return () => {
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ---------- 开始录音 ----------
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const updateMeter = () => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setVocalLevel(avg);
        animationFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        // 1) 组装 blob
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        // 2) 生成消息元数据
        const id = genId();
        const node = "NODE-" + Math.floor(Math.random() * 999);
        const duration = recordingTime;
        const timestamp = Date.now();

        // 3) 上传 + 写库
        setSyncStatus("SYNCING");

        try {
          // 建议统一路径，方便后续管理
          const filePath = `public/${id}.webm`;

          // 3.1 上传到 Storage
          const { error: uploadErr } = await supabase.storage
            .from(BUCKET)
            .upload(filePath, blob, {
              contentType: "audio/webm",
              upsert: true,
            });

          if (uploadErr) throw uploadErr;

          // 3.2 写入数据库（元数据）
          const { error: dbErr } = await supabase.from(TABLE).insert({
            id,
            file_path: filePath,
            duration,
            node,
          });

          if (dbErr) throw dbErr;

          // 3.3 更新前端列表（用 public url）
          const url = toPlayableUrl(filePath);
          const newMsg: VoiceMessage = {
            id,
            url,
            duration,
            timestamp,
            node,
            file_path: filePath,
          };

          setMessages((p) => [newMsg, ...p]);
          setRecordingTime(0);
          setSyncStatus("IDLE");
        } catch (err) {
          console.error("Upload/Insert failed:", err);
          setSyncStatus("ERROR");
        } finally {
          // 关闭硬件资源
          stream.getTracks().forEach((t) => t.stop());
          audioCtx.close().catch(() => {});
          streamRef.current = null;
          audioCtxRef.current = null;
        }
      };

      // 开始
      mediaRecorder.start();
      setIsRecording(true);
      timerIntervalRef.current = window.setInterval(
        () => setRecordingTime((p) => p + 1),
        1000
      );
    } catch (err) {
      console.error("Recording failed:", err);
      setSyncStatus("ERROR");
    }
  };

  // ---------- 停止录音 ----------
  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);

    if (timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  // ---------- 播放 ----------
  const playMessage = (msg: VoiceMessage) => {
    if (!audioPlayerRef.current) return;

    if (playingId === msg.id) {
      audioPlayerRef.current.pause();
      setPlayingId(null);
      return;
    }

    audioPlayerRef.current.src = msg.url;
    audioPlayerRef.current.play().catch((e) => console.error("Play failed:", e));
    setPlayingId(msg.id);

    audioPlayerRef.current.onended = () => setPlayingId(null);
  };

  // 关闭面板时清理
  useEffect(() => {
    if (isOpen) return;

    // stop recording if user closes panel while recording
    if (isRecording) {
      try {
        stopRecording();
      } catch {}
    }

    // stop playing
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.src = "";
    }
    setPlayingId(null);

    // release mic
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

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
                ? "同步连接失败"
                : "云端已就绪"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadMessages}
            className="text-yellow-500/40 hover:text-yellow-500 text-[10px] transition-colors"
            title="刷新"
          >
            [刷新]
          </button>
          <button
            onClick={onClose}
            className="text-yellow-500/40 hover:text-yellow-500 text-[10px] transition-colors"
          >
            [关闭终端]
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-6 scrollbar-thin scrollbar-thumb-yellow-500/20">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-20 italic">
            <p className="text-[9px] text-white tracking-widest">
              暂无云端存档数据
            </p>
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
                    playingId === msg.id
                      ? "bg-yellow-500/20"
                      : "hover:border-yellow-500/60"
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
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      提取声纹存档
                    </>
                  )}
                </button>

                <div className="ml-4 text-right">
                  <div className="text-white text-[10px] font-mono leading-none">
                    {msg.duration}S
                  </div>
                  <div className="text-white/20 text-[6px] font-mono mt-1">
                    {msg.node}
                  </div>
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
          <p className="text-[7px] text-white/20 uppercase">
            声音将上传至拾七核心存档库
          </p>
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
              isRecording
                ? "w-8 h-8 rounded-sm bg-red-600"
                : "w-10 h-10 rounded-full bg-yellow-500"
            }`}
            style={{ transform: isRecording ? `scale(${1 + vocalLevel / 80})` : "none" }}
          ></div>
        </button>

        <div className="w-full flex justify-between px-2 mt-2 opacity-30 text-[6px] text-white font-mono uppercase">
          <span>Lat: 24ms</span>
          <span>Prot: HTTPS</span>
          <span>Enc: OPUS_64</span>
        </div>
      </div>

      <audio ref={audioPlayerRef} className="hidden" />
    </div>
  );
};

export default VoiceArchive;
