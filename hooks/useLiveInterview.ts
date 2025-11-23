import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';

// --- Audio Utils (per Google GenAI Guidelines) ---

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const useLiveInterview = (role: string, videoRef: React.RefObject<HTMLVideoElement | null>) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const videoIntervalRef = useRef<number | null>(null);
  const demoIntervalRef = useRef<number | null>(null);
  
  // Transcription state
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  const connect = useCallback(async () => {
    try {
      setError(null);
      // --- SAFE API KEY RETRIEVAL ---
      let apiKey: string | null = null;
      
      // 1. Try Local Storage
      try {
        apiKey = localStorage.getItem('gemini_api_key');
      } catch (e) {}

      // 2. Try Env (fallback)
      if (!apiKey) {
        try {
           if (typeof process !== 'undefined' && process.env) {
             apiKey = process.env.API_KEY || null;
           }
        } catch (e) {}
      }
      
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });

      // Get User Media (Audio + Video) - Attempt this even for demo mode to show user their camera
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        
        // Setup Video Preview
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
        }
      } catch (e) {
        console.warn("Camera/Mic access denied or unavailable", e);
        if (apiKey) {
            throw new Error("Microphone and Camera access are required for the live interview.");
        }
      }

      // --- DEMO / OFFLINE MODE CHECK ---
      if (!apiKey) {
        setIsConnected(true);
        addLog("[DEMO MODE] No API Key detected. Starting simulated interview session.");
        addLog("AI: Hello! Welcome to your interview simulation.");
        
        let demoStep = 0;
        const demoScripts = [
          `AI: I see you are applying for the ${role} position. Can you tell me a bit about yourself?`,
          "AI: That's a great background. What specific technical challenges have you faced recently?",
          "AI: Interesting approach. How do you handle conflict within a team setting?",
          "AI: Thank you for sharing that. Do you have any questions for us about the company?"
        ];

        // Simulate a conversation loop
        demoIntervalRef.current = window.setInterval(() => {
           if (demoStep < demoScripts.length) {
              const msg = demoScripts[demoStep];
              addLog(msg);
              
              // Simulate "Speaking" indicator
              setIsSpeaking(true);
              setTimeout(() => setIsSpeaking(false), 3000); 
              
              demoStep++;
           } else {
              addLog("AI: This concludes our demo interview session. Thank you!");
              if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
           }
        }, 6000); 

        return; // Exit real connection setup
      }

      // --- REAL API CONNECTION ---
      if (!stream) throw new Error("Stream not initialized");

      const ai = new GoogleGenAI({ apiKey });
      
      // Setup Audio Input
      const inputContext = new AudioContextClass({ sampleRate: 16000 });
      const source = inputContext.createMediaStreamSource(stream);
      // ScriptProcessor is deprecated but still the standard for raw PCM access in this context
      const processor = inputContext.createScriptProcessor(4096, 1, 1);
      
      inputSourceRef.current = source;
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(inputContext.destination);

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            addLog("Connected to Interviewer");
            
            // 1. Stream Audio
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => {
                  session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            // 2. Stream Video Frames (approx 1 FPS is sufficient for interview presence)
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            videoIntervalRef.current = window.setInterval(() => {
                if (videoRef.current && ctx) {
                    canvas.width = videoRef.current.videoWidth || 640;
                    canvas.height = videoRef.current.videoHeight || 480;
                    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                    
                    const base64Image = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
                    
                    sessionPromise.then(session => {
                        session.sendRealtimeInput({
                            media: { mimeType: 'image/jpeg', data: base64Image }
                        });
                    });
                }
            }, 1000); // 1 FPS
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Handle Transcription
            if (msg.serverContent?.outputTranscription) {
                currentOutputTranscription.current += msg.serverContent.outputTranscription.text;
            } else if (msg.serverContent?.inputTranscription) {
                currentInputTranscription.current += msg.serverContent.inputTranscription.text;
            }

            if (msg.serverContent?.turnComplete) {
                if (currentInputTranscription.current) {
                    addLog(`You: ${currentInputTranscription.current}`);
                    currentInputTranscription.current = '';
                }
                if (currentOutputTranscription.current) {
                    addLog(`AI: ${currentOutputTranscription.current}`);
                    currentOutputTranscription.current = '';
                }
            }

            // Handle Audio
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              setIsSpeaking(true);
              const audioCtx = audioContextRef.current;
              if (!audioCtx) return;

              const audioBuffer = await decodeAudioData(
                 decode(audioData),
                 audioCtx,
                 24000,
                 1
              );

              const source = audioCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(audioCtx.destination);
              
              const now = audioCtx.currentTime;
              const startTime = Math.max(now, nextStartTimeRef.current);
              source.start(startTime);
              nextStartTimeRef.current = startTime + audioBuffer.duration;
              
              source.onended = () => {
                 // Simple heuristic for speaking state
                 if (audioCtx.currentTime >= nextStartTimeRef.current) {
                     setIsSpeaking(false);
                 }
              };
            }
          },
          onclose: () => {
            setIsConnected(false);
            addLog("Connection closed");
          },
          onerror: (err) => {
            console.error(err);
            setError("Connection error occurred. Please check your network.");
            setIsConnected(false);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } }
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: `You are a professional HR manager conducting a video interview for a candidate applying for the position of "${role}". 
          You can see the candidate via their camera feed. 
          Start by greeting them warmly and asking them to introduce themselves. 
          Ask one question at a time. 
          Focus on soft skills, past experience, and situational questions related to ${role}.`
        }
      });
      

    } catch (err: any) {
      setError(err.message);
      setIsConnected(false);
    }
  }, [role, videoRef]);

  const disconnect = useCallback(() => {
    if (inputSourceRef.current) inputSourceRef.current.disconnect();
    if (processorRef.current) processorRef.current.disconnect();
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') audioContextRef.current.close();
    if (videoIntervalRef.current) window.clearInterval(videoIntervalRef.current);
    if (demoIntervalRef.current) window.clearInterval(demoIntervalRef.current);
    
    // Stop tracks
    if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        const tracks = stream.getTracks ? stream.getTracks() : [];
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
    }

    setIsConnected(false);
    setIsSpeaking(false);
    nextStartTimeRef.current = 0;
  }, [videoRef]);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return { connect, disconnect, isConnected, isSpeaking, error, logs };
};