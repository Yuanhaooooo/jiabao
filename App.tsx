
import React, { useState, Suspense, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Stars, Float } from '@react-three/drei';
import * as THREE from 'three';
import ParticleSystem from './components/ParticleSystem';
import Effects from './components/Effects';
import { ExperienceState, GreetingData } from './types';
import { generateLuxuryGreeting } from './services/geminiService';

const TypewriterText: React.FC<{ text: string; delay?: number }> = ({ text, delay = 50 }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [index, setIndex] = useState(0);

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
      <div className="text-yellow-500/40 text-[7px] uppercase tracking-widest mb-1">张家宝 已度过地球时间</div>
      <div className="text-yellow-500 font-mono text-[10px] tracking-widest bg-yellow-500/5 px-2 py-1 border border-yellow-500/10">{timeStr}</div>
    </div>
  );
};

const CameraFrame: React.FC<{ isActive: boolean }> = ({ isActive }) => {
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
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isActive]);

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const link = document.createElement('a');
        link.download = `ZJB_17_MEMORIAL_${Date.now()}.png`;
        link.href = canvasRef.current.toDataURL();
        link.click();
      }
    }
  };

  if (!isActive) return null;

  return (
    <div className="fixed top-1/2 left-12 -translate-y-1/2 w-72 h-96 border border-yellow-500/30 bg-black/80 backdrop-blur-xl p-1 pointer-events-auto animate-in fade-in slide-in-from-left-10 duration-500 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)]">
      <div className="relative flex-1 overflow-hidden group">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover grayscale brightness-75 contrast-125" />
        <canvas ref={canvasRef} className="hidden" />
        <div className="absolute inset-0 border border-yellow-500/20 pointer-events-none"></div>
        <div className="scanline"></div>
        
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity">
           <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-yellow-500">
             <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/>
             <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/>
             <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/>
             <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
           </svg>
        </div>

        <div className="absolute top-2 left-2 flex gap-1 items-center">
          <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse shadow-[0_0_5px_red]"></div>
          <p className="text-[7px] text-yellow-500/80 font-mono tracking-tighter uppercase">BIO_CAPTURE_MODE: SCANNING_PALM</p>
        </div>

        <button 
          onClick={takePhoto}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 border border-yellow-500/40 bg-black/60 hover:bg-yellow-500/30 text-[9px] text-yellow-500 uppercase tracking-widest transition-all backdrop-blur-md"
        >
          [ 确认捕获 / 手掌识别 ]
        </button>
      </div>
      <div className="p-2 text-center text-[8px] text-yellow-500/40 uppercase tracking-widest font-mono">
        BIO_CAPTURE_FRAME // SEQ_17_ZJB
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
  
  const subjectName = '张家宝';
  const analyserRef = useRef<AnalyserNode | null>(null);
  const fsmTimerRef = useRef<number>(0);
  const lastStateTimeRef = useRef<number>(Date.now());

  const DURATIONS: Record<string, number> = {
    COUNTDOWN: 3000,
    MORPH_CAKE: 4000,
    CANDLES_LIT: Infinity, 
    BLOW_OUT: 2000,
    GIFT_OPEN: Infinity,
  };

  const initMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      setMicActive(true);
      setState('LISTENING');
    } catch (err) {
      console.error("Mic access denied", err);
      setState('LISTENING');
    }
  };

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
      } else {
        if (duration !== Infinity) {
          setProgress(Math.min(elapsed / duration, 1));
        }
      }

      if (analyserRef.current && micActive) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        
        if (average > 75) { 
          if (state === 'LISTENING') {
            setState('COUNTDOWN');
            lastStateTimeRef.current = now;
          } else if (state === 'CANDLES_LIT') {
            setState('BLOW_OUT');
            lastStateTimeRef.current = now;
          }
        }
      }

      fsmTimerRef.current = requestAnimationFrame(update);
    };

    fsmTimerRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(fsmTimerRef.current);
  }, [state, micActive]);

  const handleInitialize = async () => {
    const result = await generateLuxuryGreeting(subjectName);
    setGreeting(result);
    initMic();
  };

  const fixedMessage = `张家宝，生日快乐。
祝你享受宇宙尘埃中的每一刻平和喜乐。

愿你的时间运行稳定，
情绪噪声保持在低频区间。
在宇宙持续展开的过程中，
你始终处于努力的同步运动拓展状态。
17岁生日已到达。愿你一切运行良好。`;

  return (
    <div className="relative w-full h-screen bg-[#020202] overflow-hidden select-none font-pixel">
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(#ca8a04 1px, transparent 1px), linear-gradient(90deg, #ca8a04 1px, transparent 1px)',
        backgroundSize: '100px 100px'
      }}></div>

      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 1, 12]} fov={35} />
        <OrbitControls 
          enablePan={false} 
          enableZoom={false} 
          autoRotate={state === 'IDLE' || state === 'LISTENING' || state === 'GIFT_OPEN'} 
          autoRotateSpeed={0.35}
        />
        
        <Suspense fallback={null}>
          <ParticleSystem state={state} progress={progress} />
          
          {(state === 'CANDLES_LIT' || (state === 'BLOW_OUT' && progress < 0.2)) && (
            <group position={[0, 1.8, 0]}>
              <Float speed={8} rotationIntensity={1} floatIntensity={1}>
                <mesh>
                  <sphereGeometry args={[0.15, 32, 32]} />
                  <meshStandardMaterial 
                    color="#ffd700" 
                    emissive="#ca8a04" 
                    emissiveIntensity={state === 'BLOW_OUT' ? 20 * (1 - progress) : 15} 
                  />
                  <pointLight intensity={state === 'BLOW_OUT' ? 30 * (1 - progress) : 25} color="#ca8a04" distance={10} />
                </mesh>
              </Float>
            </group>
          )}

          <Environment preset="night" />
          <ambientLight intensity={0.05} />
          <Stars radius={150} depth={50} count={7000} factor={4} saturation={0.5} fade speed={1.5} />
          <Effects />
        </Suspense>
      </Canvas>

      {/* Experience UI Overlay */}
      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-8 md:p-12 z-10 font-pixel">
        <div className="w-full flex justify-between items-start">
          <div className="text-left border-l border-yellow-500/30 pl-4">
            <h1 className="text-[10px] tracking-[0.8em] uppercase text-yellow-500/60 mb-1">AETHELGARD CORE v3.1</h1>
            <p className="text-white/20 text-[8px] tracking-[0.3em]">SYNCHRONIZING BIO-METRIC... STATUS: STABLE</p>
          </div>
          <div className="text-right">
             <div className="flex flex-col items-end gap-3 pointer-events-auto">
                {state === 'GIFT_OPEN' && (
                  <>
                    <button 
                      onClick={() => setIsCameraActive(!isCameraActive)}
                      className={`w-12 h-12 border border-yellow-500/30 flex items-center justify-center transition-all bg-black/40 ${isCameraActive ? 'bg-yellow-500/20 shadow-[0_0_15px_rgba(202,138,4,0.4)] border-yellow-500' : 'hover:bg-white/10'}`}
                      title="记录留存"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
                      </svg>
                    </button>
                    <button 
                      onClick={() => setIsMailOpen(!isMailOpen)}
                      className={`w-12 h-12 border border-yellow-500/30 flex items-center justify-center transition-all bg-black/40 ${isMailOpen ? 'bg-yellow-500/20 shadow-[0_0_15px_rgba(202,138,4,0.4)] border-yellow-500' : 'hover:bg-white/10'}`}
                      title="祝辞协议"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500">
                        <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
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
              <h2 className="font-pixel text-5xl text-white mb-2 tracking-widest uppercase">张家宝</h2>
              <p className="text-yellow-500/60 text-[11px] uppercase tracking-[0.6em] mb-12 italic">维度觉醒协议：17 岁生辰</p>
              
              <button onClick={handleInitialize} className="group relative px-12 py-5 overflow-hidden rounded-sm transition-all bg-transparent border border-yellow-500/50">
                <div className="absolute inset-0 bg-yellow-500/10 group-hover:bg-yellow-500/20 transition-colors"></div>
                <div className="relative text-yellow-500 tracking-[0.5em] uppercase text-sm font-bold">启动庆典系统</div>
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-yellow-500"></div>
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-yellow-500"></div>
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-yellow-500"></div>
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-yellow-500"></div>
              </button>
            </div>
          )}

          {state === 'LISTENING' && (
            <div className="animate-in fade-in duration-1000">
              <div className="flex justify-center mb-8 relative">
                <div className="absolute inset-0 flex items-center justify-center opacity-20">
                   <div className="w-40 h-40 border border-yellow-500 rounded-full animate-ping"></div>
                </div>
                <div className="w-16 h-16 border-2 border-yellow-500 rounded-full flex items-center justify-center">
                   <div className="w-6 h-6 bg-yellow-500 rounded-full shadow-[0_0_30px_#ca8a04]"></div>
                </div>
              </div>
              <p className="text-yellow-500/60 uppercase tracking-[0.8em] text-[10px] mb-4">等待音频冲击信号</p>
              <h2 className="text-white text-2xl font-light tracking-[0.4em] mb-2 uppercase">对着麦克风吹气以激发星云</h2>
            </div>
          )}

          {state === 'COUNTDOWN' && (
            <div className="space-y-6">
              <p className="text-yellow-500 uppercase tracking-[1em] text-[12px] opacity-60">星云结构压缩中</p>
              <div className="text-[10rem] leading-none text-white font-pixel opacity-80 animate-pulse drop-shadow-[0_0_20px_white]">
                {Math.ceil(3 * (1 - progress))}
              </div>
            </div>
          )}

          {state === 'MORPH_CAKE' && (
            <div className="space-y-6">
              <p className="text-yellow-500 uppercase tracking-[0.8em] text-[10px]">凝聚物质位面实体</p>
              <div className="font-mono text-[9px] text-white/30 tracking-widest uppercase">COALESCING_PARTICLES... {Math.round(progress * 100)}%</div>
            </div>
          )}

          {state === 'CANDLES_LIT' && (
            <div className="animate-in fade-in duration-1000 flex flex-col items-center">
              <div className="mb-8 p-8 border border-yellow-500/20 backdrop-blur-md bg-black/40">
                <p className="text-yellow-500 uppercase tracking-[1em] text-[14px] mb-4 font-bold border-b border-yellow-500/40 pb-4">拾七 · 华诞</p>
                <h2 className="text-white text-6xl mb-2 font-pixel">张家宝</h2>
                <p className="text-white/40 tracking-[0.5em] text-[10px] italic">愿以此光，引向不朽的辉煌</p>
              </div>
              <p className="text-yellow-500/80 uppercase tracking-[0.6em] text-[11px] animate-bounce bg-yellow-500/10 px-6 py-2 rounded-full border border-yellow-500/20">再次吹气 · 完成升维契约</p>
            </div>
          )}

          {state === 'GIFT_OPEN' && greeting && isMailOpen && (
            <div className="animate-in fade-in slide-in-from-bottom-20 duration-1000 space-y-6 max-w-2xl mx-auto pointer-events-auto">
              <div className="relative p-10 bg-black/90 backdrop-blur-3xl border border-yellow-500/20 text-left overflow-y-auto max-h-[75vh] shadow-[0_0_100px_rgba(0,0,0,0.8)]">
                <div className="absolute top-0 right-0 w-24 h-24 border-t border-r border-yellow-500/20 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 border-b border-l border-yellow-500/20 pointer-events-none"></div>
                
                <div className="flex items-center justify-between gap-4 mb-8 border-b border-yellow-500/10 pb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 bg-yellow-500 animate-pulse shadow-[0_0_10px_#ca8a04]"></div>
                    <p className="text-yellow-500 uppercase tracking-[0.4em] text-[10px] font-bold">MESSAGE_ENCODED // PROTOCOL_17</p>
                  </div>
                  <LifeTimer />
                </div>

                <div className="font-pixel text-white/95 text-base leading-relaxed tracking-wider space-y-8">
                  <div className="text-yellow-500/50 text-[10px] mb-2 uppercase tracking-tighter font-bold underline decoration-yellow-500/20 underline-offset-4">[ADDR: CORE_ZJB]</div>
                  <div className="bg-white/5 p-4 border-l-2 border-yellow-500/40">
                    <TypewriterText text={fixedMessage} delay={25} />
                  </div>
                  
                  <div className="border-t border-yellow-500/10 pt-8 mt-8">
                    <div className="text-yellow-500/50 text-[10px] mb-4 uppercase tracking-tighter font-bold">[EXT: AI_GREETING_PROTOCOL]</div>
                    <div className="text-yellow-500 italic text-sm md:text-lg leading-relaxed px-4">
                      <TypewriterText text={`\n"${greeting.message}"`} delay={35} />
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-end mt-12 font-mono text-[7px] opacity-30 uppercase tracking-[0.3em]">
                  <p>ENCR_STDR: RIJNDAEL_XTR_256</p>
                  <p>ORIGIN_NODE: {greeting.author}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="w-full flex justify-between items-end opacity-20 text-[8px] text-white uppercase tracking-[0.4em] font-mono">
          <div className="flex flex-col gap-1">
             <div>ENV_STATE: {state}</div>
             <div>ZJB_LIFESPAN: 17_UNIT</div>
          </div>
          <div className="text-right">
             <div>SYSTEM_SYNC: ACTIVE</div>
             <div>FREQ: 60_FPS</div>
          </div>
        </div>
      </div>

      <CameraFrame isActive={isCameraActive} />
      
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 25s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default App;
