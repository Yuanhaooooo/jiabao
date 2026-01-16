import React, { useState, Suspense, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Stars, Float } from '@react-three/drei';
import ParticleSystem from './components/ParticleSystem';
import Effects from './components/Effects';
import VoiceArchive from './components/VoiceArchive';
import { ExperienceState, GreetingData } from './types';
import { generateLuxuryGreeting } from './services/geminiService';

const GREETING_CACHE_KEY = 'ZJB_AI_GREETING_V1';

const TypewriterText: React.FC<{ text: string; delay?: number }> = ({ text, delay = 50 }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // 每次 text 变化时，重置打字机（避免切换面板/重新初始化时续写旧内容）
    setDisplayedText('');
    setIndex(0);
  }, [text]);

  useEffect(() => {
    if (index < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + text[index]);
        setIndex((prev) => prev + 1);
      }, delay);
      return () => clearTimeout(timeout);
    }
  }, [index, text, delay]);

  return <span className="typewriter-cursor whitespace-pre-wrap">{displayedText}</span>;
};

const LifeTimer: React.FC = () => {
  const [timeStr, setTimeStr] = useState('');
  const startDate = useRef(new Date('2009-01-17T03:00:00'));

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const diff = now.getTime() - startDate.current.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      const msecs = Math.floor(diff % 1000);
      setTimeStr(`${hours.toLocaleString()}H ${mins}M ${secs}S ${msecs.toString().padStart(3, '0')}MS`);
    }, 47);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-end">
      <div className="text-yellow-500/40 text-[7px] uppercase tracking-widest mb-1 font-mono">张家宝 已度过地球时间</div>
      <div className="text-yellow-500 font-mono text-[10px] tracking-widest bg-yellow-500/5 px-2 py-1 border border-yellow-500/10 shadow-[0_0_10px_rgba(202,138,4,0.1)]">{timeStr}</div>
    </div>
  );
};

const CameraFrame: React.FC<{ isActive: boolean; onFlash: () => void }> = ({ isActive, onFlash }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isActive) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            streamRef.current = stream;
          }
        })
        .catch((err) => console.error("Camera access error:", err));
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
    return () => { if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop()); };
  }, [isActive]);

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        onFlash();
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const link = document.createElement('a');
        link.download = `ZJB_17_BIO_RECORD_${Date.now()}.png`;
        link.href = canvasRef.current.toDataURL();
        link.click();
      }
    }
  };

  if (!isActive) return null;

  return (
    <div className="fixed top-1/2 left-12 -translate-y-1/2 w-80 h-[480px] border border-yellow-500/30 bg-black/80 backdrop-blur-xl p-1 pointer-events-auto animate-in fade-in slide-in-from-left-10 duration-500 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)] z-50">
      <div className="relative flex-1 overflow-hidden group border border-yellow-500/10">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover grayscale brightness-75 contrast-125" />
        <canvas ref={canvasRef} className="hidden" />
        <div className="absolute inset-0 border border-yellow-500/20 pointer-events-none"></div>
        <div className="scanline"></div>
        <div className="absolute top-2 left-2 flex gap-1 items-center">
          <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse shadow-[0_0_5px_#ca8a04]"></div>
          <p className="text-[7px] text-yellow-500/80 font-mono tracking-tighter uppercase">实时视觉流: BIO_STABILIZED</p>
        </div>
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-4 w-[85%] items-center">
          <button onClick={takePhoto} className="w-full py-4 border border-yellow-500/50 bg-yellow-500/5 hover:bg-yellow-500/20 text-[10px] text-yellow-500 uppercase tracking-[0.5em] transition-all backdrop-blur-md font-mono shadow-[0_0_15px_rgba(202,138,4,0.1)] group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-500/10 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]"></div>
            [ 记录实时流帧 ]
          </button>
          <div className="flex flex-col items-center gap-1.5 opacity-60">
            <div className="flex gap-2">
              <span className="w-1 h-1 bg-yellow-500/40 rounded-full animate-pulse"></span>
              <span className="w-1 h-1 bg-yellow-500/40 rounded-full animate-pulse delay-75"></span>
            </div>
            <p className="text-[9px] text-yellow-500 font-pixel tracking-widest animate-pulse">别忘记合影留念</p>
          </div>
        </div>
      </div>
      <div className="p-3 text-center flex justify-between items-center">
        <span className="text-[7px] text-yellow-500/30 font-mono">SECURE_CHANNEL_17</span>
        <span className="text-[8px] text-yellow-500/40 uppercase tracking-widest font-mono">BIO_RECORDER // CORE</span>
        <span className="text-[7px] text-yellow-500/30 font-mono">STABLE</span>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [state, setState] = useState<ExperienceState>('IDLE');
  const [progress, setProgress] = useState(0);
  const [greeting, setGreeting] = useState<GreetingData | null>(null);
  const [micActive, setMicActive] = useState(false);
  const [isMailOpen, setIsMailOpen] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [showFlash, setShowFlash] = useState(false);

  const subjectName = '张家宝';

  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const fsmTimerRef = useRef<number>(0);
  const lastStateTimeRef = useRef<number>(Date.now());

  // ✅ 吹气加强：连续帧 + 冷却
  const blowHitFramesRef = useRef<number>(0);
  const lastTriggerAtRef = useRef<number>(0);

  const DURATIONS: Record<string, number> = {
    COUNTDOWN: 3000,
    MORPH_CAKE: 4000,
    CANDLES_LIT: Infinity,
    BLOW_OUT: 2000,
    GIFT_OPEN: Infinity,
  };

  const triggerFlash = () => { setShowFlash(true); setTimeout(() => setShowFlash(false), 150); };

  const initMic = async () => {
    try {
      // ✅ 关键：尽量关掉手机端“自动处理”，保留你的第一份思路
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        } as any,
        video: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // 收口：如果之前有 stream，先关
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
      }
      micStreamRef.current = stream;

      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;

      // 有些浏览器需要用户手势后 resume，这里做一次尝试
      if (audioCtx.state === 'suspended') {
        try { await audioCtx.resume(); } catch {}
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();

      // ✅ 保留你的第一份：更高精度
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.65; // ✅ 轻微平滑：更稳，不影响吹气峰值太多

      source.connect(analyser);
      analyserRef.current = analyser;

      setMicActive(true);
      setState('LISTENING');
    } catch (err) {
      console.warn("Mic access error, proceeding without mic", err);
      setMicActive(false);
      setState('LISTENING');
    }
  };

  // ✅ 状态机 + 吹气检测（加强版：连续帧 & 冷却时间）
  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const elapsed = now - lastStateTimeRef.current;
      const duration = DURATIONS[state] || 0;

      if (duration !== Infinity && elapsed > duration) {
        if (state === 'COUNTDOWN') setState('MORPH_CAKE');
        else if (state === 'MORPH_CAKE') setState('CANDLES_LIT');
        else if (state === 'BLOW_OUT') setState('GIFT_OPEN');
        lastStateTimeRef.current = now;
        setProgress(0);

        // 状态切换时，重置吹气计数，避免“上一段余波”影响下一段
        blowHitFramesRef.current = 0;
      } else if (duration !== Infinity) {
        setProgress(Math.min(elapsed / duration, 1));
      }

      if (analyserRef.current && micActive) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        // ✅ 低频加权（保留第一份）
        const lowFreqBins = 15;
        const lowFreqSum = dataArray.slice(0, lowFreqBins).reduce((a, b) => a + b, 0) / lowFreqBins;
        const totalAverage = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

        // ✅ 手机端阈值
        const blowThreshold = 55;

        const isHit = (lowFreqSum > blowThreshold) || (totalAverage > blowThreshold);

        // ✅ 加强：需要“连续命中”几帧才触发，防误触
        if (isHit) {
          blowHitFramesRef.current += 1;
        } else {
          blowHitFramesRef.current = Math.max(0, blowHitFramesRef.current - 1);
        }

        // ✅ 冷却：触发后至少间隔一段时间
        const cooldownMs = 900;
        const requiredFrames = 6; // 60fps 下大约 100ms 左右的持续风噪

        const canTrigger = (now - lastTriggerAtRef.current) > cooldownMs;
        const shouldTrigger = blowHitFramesRef.current >= requiredFrames;

        if (canTrigger && shouldTrigger) {
          if (state === 'LISTENING') {
            setState('COUNTDOWN');
            lastStateTimeRef.current = now;
            lastTriggerAtRef.current = now;
            blowHitFramesRef.current = 0;
          } else if (state === 'CANDLES_LIT') {
            setState('BLOW_OUT');
            lastStateTimeRef.current = now;
            lastTriggerAtRef.current = now;
            blowHitFramesRef.current = 0;
          }
        }
      }

      fsmTimerRef.current = requestAnimationFrame(update);
    };

    fsmTimerRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(fsmTimerRef.current);
  }, [state, micActive]);

  // ✅ 初始化加强：fallback +（可选）缓存
  const handleInitialize = async () => {
    const fallback: GreetingData = {
      message: "（AI 核心暂时离线）愿你仍能在星尘中保持平和与勇气。生日快乐。",
      author: "LOCAL_FALLBACK",
    };

    // ——如果你“不想缓存，每次都不同”，把下面这段缓存读取删掉即可——
    const cached = localStorage.getItem(GREETING_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed.message === "string" && typeof parsed.author === "string") {
          setGreeting(parsed);
          initMic();
          return;
        } else {
          localStorage.removeItem(GREETING_CACHE_KEY);
        }
      } catch {
        localStorage.removeItem(GREETING_CACHE_KEY);
      }
    }

    try {
      const result = await generateLuxuryGreeting(subjectName);
      if (result && typeof result.message === "string" && typeof result.author === "string") {
        setGreeting(result);
        localStorage.setItem(GREETING_CACHE_KEY, JSON.stringify(result));
      } else {
        setGreeting(fallback);
      }
      initMic();
    } catch (e) {
      console.error("AI greeting failed:", e);
      setGreeting(fallback);
      initMic();
    }
  };

  const fixedMessage =
    `张家宝，生日快乐。\n祝你享受宇宙尘埃中的每一刻平和喜乐。\n\n` +
    `愿你的时间运行稳定，\n情绪噪声保持在低频区间。\n` +
    `在宇宙持续展开的过程中，\n你始终处于努力的同步运动拓展状态。\n` +
    `17岁生日已到达。愿你一切运行良好。`;

  return (
    <div className="relative w-full h-screen bg-[#020202] overflow-hidden select-none font-pixel">
      <div className={`fixed inset-0 bg-white z-[9999] pointer-events-none transition-opacity duration-150 ${showFlash ? 'opacity-100' : 'opacity-0'}`}></div>
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#ca8a04 1px, transparent 1px), linear-gradient(90deg, #ca8a04 1px, transparent 1px)', backgroundSize: '100px 100px' }}></div>

      <Canvas shadows dpr={[1, 2]} gl={{ preserveDrawingBuffer: true, antialias: true }}>
        <PerspectiveCamera makeDefault position={[0, 1, 12]} fov={35} />
        <OrbitControls enablePan={false} enableZoom={false} autoRotate={state === 'IDLE' || state === 'LISTENING' || state === 'GIFT_OPEN'} autoRotateSpeed={0.35} />
        <Suspense fallback={null}>
          <ParticleSystem state={state} progress={progress} />
          {(state === 'CANDLES_LIT' || (state === 'BLOW_OUT' && progress < 0.2)) && (
            <group position={[0, 1.8, 0]}>
              <Float speed={8} rotationIntensity={1} floatIntensity={1}>
                <mesh>
                  <sphereGeometry args={[0.15, 32, 32]} />
                  <meshStandardMaterial color="#ffd700" emissive="#ca8a04" emissiveIntensity={state === 'BLOW_OUT' ? 20 * (1 - progress) : 15} />
                  <pointLight intensity={state === 'BLOW_OUT' ? 30 * (1 - progress) : 25} color="#ca8a04" distance={10} />
                </mesh>
              </Float>
            </group>
          )}
          <Environment preset="night" />
          <Stars radius={150} depth={50} count={7000} factor={4} saturation={0.5} fade speed={1.5} />
          <Effects />
        </Suspense>
      </Canvas>

      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-8 md:p-12 z-10 font-pixel">
        <div className="w-full flex justify-between items-start">
          <div className="text-left border-l border-yellow-500/30 pl-4">
            <h1 className="text-[10px] tracking-[0.8em] uppercase text-yellow-500/60 mb-1">AETHELGARD CORE v3.1</h1>
          </div>

          <div className="text-right pointer-events-auto">
            <div className="flex flex-col items-end gap-3">
              {state === 'GIFT_OPEN' && (
                <>
                  <button onClick={() => setIsCameraActive(!isCameraActive)} className={`w-12 h-12 border border-yellow-500/30 flex items-center justify-center transition-all bg-black/40 ${isCameraActive ? 'bg-yellow-500/20 shadow-[0_0_15px_rgba(202,138,4,0.4)] border-yellow-500' : 'hover:bg-white/10'}`}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-yellow-500">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </button>

                  <button onClick={() => setIsMailOpen(!isMailOpen)} className={`w-12 h-12 border border-yellow-500/30 flex items-center justify-center transition-all bg-black/40 ${isMailOpen ? 'bg-yellow-500/20 shadow-[0_0_15px_rgba(202,138,4,0.4)] border-yellow-500' : 'hover:bg-white/10'}`}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-yellow-500">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </button>

                  <button onClick={() => setIsArchiveOpen(!isArchiveOpen)} className={`w-12 h-12 border border-yellow-500/30 flex items-center justify-center transition-all bg-black/40 ${isArchiveOpen ? 'bg-yellow-500/20 shadow-[0_0_15px_rgba(202,138,4,0.4)] border-yellow-500' : 'hover:bg-white/10'}`}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-yellow-500">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-4xl w-full text-center">
          {state === 'IDLE' && (
            <div className="pointer-events-auto flex flex-col items-center animate-in fade-in zoom-in duration-1000">
              <div className="relative mb-8">
                <div className="absolute -inset-4 border border-yellow-500/20 rounded-full animate-spin-slow"></div>
                <div className="w-24 h-24 bg-yellow-500/10 backdrop-blur-3xl border border-yellow-500/40 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(202,138,4,0.1)]">
                  <div className="text-yellow-500 text-3xl font-luxury">17</div>
                </div>
              </div>
              <h2 className="font-pixel text-5xl text-white mb-2 uppercase">张家宝</h2>
              <p className="text-yellow-500/60 text-[11px] uppercase tracking-[0.6em] mb-12 italic">维度觉醒协议：17 岁生辰</p>
              <button onClick={handleInitialize} className="group relative px-12 py-5 border border-yellow-500/50">
                <div className="relative text-yellow-500 tracking-[0.5em] uppercase text-sm font-bold">启动庆典系统</div>
              </button>
            </div>
          )}

          {/* ✅ 保持第一份不动：如果你想显示 LISTENING/COUNTDOWN 等 UI，我也可以在“不改风格”的前提下加上去 */}
          {state === 'GIFT_OPEN' && greeting && isMailOpen && (
            <div className="animate-in fade-in slide-in-from-bottom-20 duration-1000 space-y-6 max-w-2xl mx-auto pointer-events-auto">
              <div className="relative p-10 bg-black/90 backdrop-blur-3xl border border-yellow-500/20 text-left overflow-y-auto max-h-[75vh] shadow-[0_0_100px_rgba(0,0,0,0.8)]">
                <div className="flex items-center justify-between gap-4 mb-8 border-b border-yellow-500/10 pb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 bg-yellow-500 animate-pulse"></div>
                    <p className="text-yellow-500 uppercase tracking-[0.4em] text-[10px] font-bold font-mono">MESSAGE_ENCODED // PROTOCOL_17</p>
                  </div>
                  <LifeTimer />
                </div>

                <div className="font-pixel text-white/95 text-base leading-relaxed tracking-wider space-y-8">
                  <div className="bg-white/5 p-4 border-l-2 border-yellow-500/40">
                    <TypewriterText text={fixedMessage} delay={25} />
                  </div>
                  <div className="border-t border-yellow-500/10 pt-8 mt-8">
                    <div className="text-yellow-500 italic text-sm md:text-lg">
                      <TypewriterText text={`\n"${greeting.message}"`} delay={35} />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>

      <CameraFrame isActive={isCameraActive} onFlash={triggerFlash} />
      <VoiceArchive isOpen={isArchiveOpen} onClose={() => setIsArchiveOpen(false)} />
      <style>{`@keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes shimmer { 100% { transform: translateX(100%); } } .animate-spin-slow { animation: spin-slow 25s linear infinite; }`}</style>
    </div>
  );
};

export default App;
