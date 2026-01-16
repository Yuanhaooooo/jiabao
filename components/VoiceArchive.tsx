
import React, { useState, useRef, useEffect } from 'react';

interface VoiceMessage {
  id: string;
  blob: Blob;
  url: string;
  duration: number;
  timestamp: number;
  node: string;
}

// IndexedDB 助手函数
const DB_NAME = 'ZJB_VOICE_ARCHIVE';
const STORE_NAME = 'messages';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const VoiceArchive: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [vocalLevel, setVocalLevel] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // 初始化时加载数据库中的档案
  useEffect(() => {
    const loadArchives = async () => {
      try {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => {
          const loaded = (request.result as any[]).map(item => ({
            ...item,
            url: URL.createObjectURL(item.blob) // 为存储的 Blob 创建可播放 URL
          }));
          // 按时间倒序排列
          setMessages(loaded.sort((a, b) => b.timestamp - a.timestamp));
        };
      } catch (err) {
        console.error("Failed to load IndexedDB:", err);
      }
    };
    loadArchives();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const saveToDB = async (message: Omit<VoiceMessage, 'url'>) => {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(message);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyzer = audioCtx.createAnalyser();
      analyzer.fftSize = 256;
      source.connect(analyzer);
      analyzerRef.current = analyzer;

      const updateVolume = () => {
        const dataArray = new Uint8Array(analyzer.frequencyBinCount);
        analyzer.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setVocalLevel(average);
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();

      const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/wav'];
      const mimeType = types.find(t => MediaRecorder.isTypeSupported(t)) || '';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128000 });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        const id = 'MSG-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        const node = 'NODE-' + Math.floor(Math.random() * 999).toString().padStart(3, '0');
        
        const newMessageMeta = {
          id,
          blob: audioBlob,
          duration: recordingTime,
          timestamp: Date.now(),
          node: node
        };

        // 保存到数据库
        await saveToDB(newMessageMeta);
        
        // 更新 UI
        setMessages(prev => [{ ...newMessageMeta, url: URL.createObjectURL(audioBlob) }, ...prev]);
        
        setRecordingTime(0);
        setVocalLevel(0);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        stream.getTracks().forEach(track => track.stop());
        audioCtx.close();
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingTime(prev => (prev >= 120 ? 120 : prev + 1));
      }, 1000);
    } catch (err) {
      console.error("Recording error:", err);
      alert("无法访问麦克风。");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const playMessage = (msg: VoiceMessage) => {
    if (playingId === msg.id) {
      audioPlayerRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.src = msg.url;
      audioPlayerRef.current.play().then(() => setPlayingId(msg.id));
      audioPlayerRef.current.onended = () => setPlayingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-1/2 right-12 -translate-y-1/2 w-80 h-[550px] border border-yellow-500/30 bg-black/95 backdrop-blur-3xl p-6 pointer-events-auto animate-in fade-in slide-in-from-right-10 duration-500 flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.9)] z-50">
      <div className="flex items-center justify-between mb-4 border-b border-yellow-500/20 pb-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-yellow-500 animate-pulse"></div>
            <h3 className="text-yellow-500 text-[10px] uppercase tracking-[0.3em] font-bold font-mono">永恒语音存档库</h3>
          </div>
          <span className="text-[6px] text-yellow-500/40 font-mono mt-1 uppercase">Eternal Archive // Capacity: Unlimited</span>
        </div>
        <button onClick={onClose} className="text-yellow-500/40 hover:text-yellow-500 text-[10px] transition-colors">[关闭]</button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-6 scrollbar-thin">
        {messages.map((msg) => (
          <div key={msg.id} className={`group relative p-3 border transition-all ${playingId === msg.id ? 'border-yellow-500/60 bg-yellow-500/10' : 'border-yellow-500/10 bg-white/5 hover:bg-yellow-500/5'}`}>
            <div className="flex justify-between items-start mb-2">
              <div className="flex flex-col">
                <span className="text-[7px] text-yellow-500 font-mono font-bold">{msg.id}</span>
                <span className="text-[6px] text-yellow-500/40 font-mono tracking-tighter italic">FROM: {msg.node}</span>
              </div>
              <span className="text-[7px] text-yellow-500/40 font-mono">{new Date(msg.timestamp).toLocaleDateString()} {new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={() => playMessage(msg)}
                className={`w-9 h-9 flex items-center justify-center border transition-all ${playingId === msg.id ? 'bg-yellow-500 text-black border-yellow-500' : 'border-yellow-500/30 text-yellow-500 hover:border-yellow-500'}`}
              >
                {playingId === msg.id ? (
                  <div className="flex gap-1 items-end h-3">
                    <div className="w-1 bg-black animate-[v-bounce_0.6s_infinite]"></div>
                    <div className="w-1 bg-black animate-[v-bounce_0.8s_infinite]"></div>
                    <div className="w-1 bg-black animate-[v-bounce_0.4s_infinite]"></div>
                  </div>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                )}
              </button>
              <div className="flex-1">
                <div className="h-[2px] bg-yellow-500/10 w-full relative overflow-hidden rounded-full">
                   {playingId === msg.id && <div className="absolute inset-0 bg-yellow-500 animate-[progress_linear_infinite]" style={{ animationDuration: `${msg.duration}s` }}></div>}
                </div>
                <div className="flex justify-between mt-2">
                   <div className="flex gap-1">
                      <div className="w-1 h-1 bg-yellow-500/50 rounded-full"></div>
                      <div className="w-1 h-1 bg-yellow-500/50 rounded-full"></div>
                      <div className="w-1 h-1 bg-yellow-500/50 rounded-full"></div>
                   </div>
                   <span className="text-[8px] text-yellow-500 font-mono font-bold">{msg.duration}S</span>
                </div>
              </div>
            </div>
            
            {/* 饰品元素 */}
            <div className="absolute -right-1 -top-1 w-1 h-1 bg-yellow-500/20"></div>
            <div className="absolute -left-1 -bottom-1 w-1 h-1 bg-yellow-500/20"></div>
          </div>
        ))}
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-20 py-12">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-yellow-500 mb-2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <p className="text-[8px] uppercase tracking-[0.4em] text-yellow-500">等待首个加密报文...</p>
          </div>
        )}
      </div>

      <div className="border-t border-yellow-500/20 pt-6">
        <div className="flex flex-col items-center gap-5">
          <div className="text-[9px] text-yellow-500/60 uppercase tracking-[0.2em] font-mono flex items-center gap-2">
            {isRecording ? (
              <>
                <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse"></span>
                录制中: {recordingTime}S / 120S
              </>
            ) : "准备采集新的语音片段"}
          </div>
          
          <div className="relative">
            {isRecording && (
              <div 
                className="absolute inset-[-15px] border border-yellow-500/20 rounded-full transition-transform duration-75"
                style={{ transform: `scale(${1 + vocalLevel / 80})`, opacity: vocalLevel / 100 }}
              ></div>
            )}
            
            <button 
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-[68px] h-[68px] rounded-full border flex items-center justify-center transition-all duration-500 relative z-10 ${isRecording ? 'border-red-600 bg-red-600/10' : 'border-yellow-500/30 bg-yellow-500/5 hover:border-yellow-500 hover:shadow-[0_0_25px_rgba(202,138,4,0.4)]'}`}
            >
              {isRecording ? (
                <div className="w-6 h-6 bg-red-600 shadow-[0_0_15px_red]"></div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-yellow-500 shadow-[0_0_20px_#ca8a04]"></div>
              )}
            </button>
          </div>
          
          <p className="text-[6px] text-yellow-500/20 uppercase tracking-[0.3em] font-mono text-center">
             [ 档案受量子加密保护 · 永久存储在本地维度 ]
          </p>
        </div>
      </div>
      
      <audio ref={audioPlayerRef} className="hidden" />
      
      <style>{`
        @keyframes v-bounce {
          0%, 100% { height: 4px; }
          50% { height: 12px; }
        }
        @keyframes progress {
          from { transform: translateX(-100%); }
          to { transform: translateX(0%); }
        }
        .scrollbar-thin::-webkit-scrollbar { width: 1px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(202, 138, 4, 0.4); }
      `}</style>
    </div>
  );
};

export default VoiceArchive;
