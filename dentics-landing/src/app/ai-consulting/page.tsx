"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, MessageCircle, Activity, Phone, Volume2, VolumeX, Settings, X } from "lucide-react";

interface Message {
  id: string;
  type: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

// Cache voices globally to avoid repeated getVoices calls
let cachedVoices: SpeechSynthesisVoice[] = [];

const AIConsulting = () => {
  const [toothDetails, setToothDetails] = useState(`Periodontitis is a serious gum disease caused by plaque buildup, which can damage the gums and bone supporting your teeth. If untreated, it may lead to tooth loss.

Signs:
Bleeding gums, Swollen or red gums, Persistent bad breath, Teeth shifting or loosening

Diagnosis:
Clinical Exam: We check how deep the pockets around your teeth, X-rays: To check for bone loss, Plaque/Tartar Check: To see the buildup causing infection.

Treatment:
Scaling & Root Planing: Deep cleaning to remove plaque and tartar, Antibiotics: To reduce infection, Surgery (if needed): For severe cases to repair damage.

Prevention:
Regular brushing, flossing, and check-ups, Stop smoking if applicable.`);

  const [consultationStarted, setConsultationStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [audioPermission, setAudioPermission] = useState<"granted" | "denied" | "prompt">("prompt");
  const [avatarState, setAvatarState] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordingStartTime = useRef<number | null>(null);
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const audioChunks = useRef<Blob[]>([]);

  // Auto-scroll to bottom of messages with smooth behavior
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Update avatar state
  useEffect(() => {
    if (isRecording) {
      setAvatarState("listening");
    } else if (isProcessing) {
      setAvatarState("thinking");
    } else if (isSpeaking) {
      setAvatarState("speaking");
    } else {
      setAvatarState("idle");
    }
  }, [isRecording, isProcessing, isSpeaking]);

  // Initialize microphone permission check
  useEffect(() => {
    const initAudio = async () => {
      try {
        const permissionStatus = await navigator.permissions.query({ name: "microphone" as PermissionName });
        setAudioPermission(permissionStatus.state as "granted" | "denied" | "prompt");

        permissionStatus.onchange = () => {
          setAudioPermission(permissionStatus.state as "granted" | "denied" | "prompt");
        };
      } catch (error) {
        console.error("Error checking microphone permission:", error);
      }
    };

    initAudio();

    return () => {
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
    };
  }, []);

  // Preload voices for faster TTS
  useEffect(() => {
    const loadVoices = () => {
      cachedVoices = window.speechSynthesis.getVoices();
      if (cachedVoices.length === 0) {
        setTimeout(loadVoices, 100);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const addMessage = (type: "user" | "assistant" | "system", content: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  // Optimized TTS function
  const speakText = (text: string) => {
    if (!isSoundEnabled) return;

    try {
      window.speechSynthesis.cancel();
      setIsSpeaking(true);

      const utterance = new SpeechSynthesisUtterance(text);
      const hindiVoice = cachedVoices.find((voice) => voice.lang.includes("hi"));
      utterance.voice = hindiVoice || null;
      utterance.lang = hindiVoice ? "hi-IN" : "en-US";
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error("Error with text-to-speech:", error);
      setIsSpeaking(false);
    }
  };

  const startRecording = async () => {
    try {
      setConnectionError(null);
      const permissionStatus = await navigator.permissions.query({ name: "microphone" as PermissionName });
      if (permissionStatus.state === "denied") {
        setAudioPermission("denied");
        addMessage("system", "Microphone access denied. Please enable it in your browser settings.");
        speakText("Microphone access denied. Please enable it in your browser settings.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        addMessage("system", "No audio input detected. Please check your microphone.");
        speakText("No audio input detected. Please check your microphone.");
        return;
      }
      console.log("Audio tracks:", audioTracks);

      let mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "audio/webm";
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          addMessage("system", "Your browser does not support the required audio formats.");
          speakText("Your browser does not support the required audio formats.");
          return;
        }
      }

      mediaRecorder.current = new MediaRecorder(stream, { mimeType });
      audioChunks.current = [];
      recordingStartTime.current = Date.now();
      setRecordingDuration(0);

      recordingInterval.current = setInterval(() => {
        if (recordingStartTime.current) {
          setRecordingDuration(Math.floor((Date.now() - recordingStartTime.current) / 1000));
        }
      }, 1000);

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        } else {
          console.warn("No audio data received in ondataavailable event.");
        }
      };

      mediaRecorder.current.start(1000);
      setIsRecording(true);
      setAudioPermission("granted");
      addMessage("system", "I'm listening. Speak clearly into your microphone.");
    } catch (error) {
      console.error("Error starting recording:", error);
      setAudioPermission("denied");
      addMessage("system", "Unable to access microphone. Please check your permissions and try again.");
      speakText("Unable to access microphone. Please check your permissions and try again.");
    }
  };

  const stopRecording = async () => {
    if (mediaRecorder.current && mediaRecorder.current.state === "recording") {
      mediaRecorder.current.stop();
      setIsRecording(false);
      setIsProcessing(true);

      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }

      const stream = mediaRecorder.current.stream;
      stream.getTracks().forEach((track) => {
        track.stop();
        console.log("Stopped track:", track);
      });

      mediaRecorder.current.onstop = async () => {
        const recordingDuration = recordingStartTime.current
          ? (Date.now() - recordingStartTime.current) / 1000
          : 0;

        console.log("Recording duration:", recordingDuration, "seconds");
        console.log("Audio chunks:", audioChunks.current);

        if (recordingDuration < 2) {
          addMessage("system", "Recording too short. Please speak for at least 2 seconds.");
          speakText("Recording too short. Please speak for at least 2 seconds.");
          setIsProcessing(false);
          return;
        }

        const audioBlob = new Blob(audioChunks.current, { type: mediaRecorder.current!.mimeType });
        console.log("Audio blob size:", audioBlob.size);

        if (audioBlob.size < 100) {
          addMessage("system", "No audio recorded. Please check your microphone and try again.");
          speakText("No audio recorded. Please check your microphone and try again.");
          setIsProcessing(false);
          return;
        }

        try {
          const formData = new FormData();
          formData.append("file", audioBlob, "audio.webm");
          // Add toothDetails as initial_message
          if (toothDetails.trim()) {
            formData.append("initial_message", toothDetails);
          }

          const response = await fetch("http://localhost:8000/transcribe", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }

          const data = await response.json();

          if (data.transcription === "" && data.ai_response) {
            addMessage("system", data.ai_response);
            speakText(data.ai_response);
          } else {
            addMessage("user", data.transcription);
            addMessage("assistant", data.ai_response);
            speakText(data.ai_response);

            // End consultation if goodbye is detected
            if (data.transcription.toLowerCase().includes("goodbye")) {
              setTimeout(() => {
                endConsultation();
              }, 2000);
            }
          }
        } catch (error) {
          console.error("Error processing audio:", error);
          setConnectionError("Connection error");
          addMessage("system", "I'm having trouble connecting right now. Please try again.");
          speakText("I'm having trouble connecting right now. Please try again.");
        } finally {
          setIsProcessing(false);
          setRecordingDuration(0);
        }
      };
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (toothDetails.trim()) {
      setConsultationStarted(true);
      addMessage("assistant", "Hello! I'm Dr. AI, your dental consultation assistant. I've reviewed your concerns, and I'm here to help. Ask me anything about your dental health.");
      speakText("Hello! I'm Dr. AI, your dental consultation assistant. I've reviewed your concerns, and I'm here to help. Ask me anything about your dental health.");
    }
  };

  const endConsultation = () => {
    setConsultationStarted(false);
    setMessages([]);
    setIsRecording(false);
    setIsProcessing(false);
    setIsSpeaking(false);
    setConnectionError(null);
    setAvatarState("idle");
    if (recordingInterval.current) {
      clearInterval(recordingInterval.current);
    }
    if (mediaRecorder.current && mediaRecorder.current.state === "recording") {
      mediaRecorder.current.stop();
    }
    window.speechSynthesis.cancel();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getAvatarEmoji = () => {
    switch (avatarState) {
      case "listening":
        return "👂";
      case "thinking":
        return "🤔";
      case "speaking":
        return "💬";
      default:
        return "🦷";
    }
  };

  const getStatusMessage = () => {
    switch (avatarState) {
      case "listening":
        return `Listening... (${formatTime(recordingDuration)})`;
      case "thinking":
        return "Analyzing your question...";
      case "speaking":
        return "Speaking...";
      default:
        return "Ready to help";
    }
  };

  const getStatusColor = () => {
    switch (avatarState) {
      case "listening":
        return "text-green-600";
      case "thinking":
        return "text-yellow-600";
      case "speaking":
        return "text-blue-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {!consultationStarted ? (
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-6">
                <span className="text-3xl">🦷</span>
              </div>
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                AI <span className="text-blue-600">Dental Consultation</span>
              </h1>
              <p className="text-xl text-gray-600">
                Get instant <span className="text-blue-600 font-semibold">dental advice</span> from your AI assistant
              </p>
            </div>

            {/* Features */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <MessageCircle className="w-6 h-6 mr-3 text-blue-600" />
                Meet Dr. AI - Your Virtual Dental Assistant
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Activity className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Interactive AI Avatar</h4>
                      <p className="text-gray-600 text-sm">Responds to your voice with visual feedback</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Mic className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Voice Conversations</h4>
                      <p className="text-gray-600 text-sm">Natural speech recognition and responses</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Settings className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Personalized Advice</h4>
                      <p className="text-gray-600 text-sm">Based on your specific dental concerns</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Phone className="w-4 h-4 text-yellow-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">24/7 Available</h4>
                      <p className="text-gray-600 text-sm">Get immediate guidance anytime</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">!</span>
                  </div>
                  <div>
                    <p className="text-sm text-amber-800">
                      <strong>Important:</strong> This is for educational purposes only. Always consult a qualified dentist for diagnosis and treatment.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="toothDetails" className="block text-lg font-semibold text-gray-900 mb-3">
                    Tell Dr. AI about your dental concerns:
                  </label>
                  <textarea
                    id="toothDetails"
                    className="w-full min-h-[200px] px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 resize-y transition-all duration-200"
                    placeholder="Describe your symptoms, pain, or concerns. For example: 'I have sensitivity to cold drinks in my back teeth and occasional throbbing pain at night.'"
                    value={toothDetails}
                    onChange={(e) => setToothDetails(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full px-8 py-4 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-lg shadow-lg"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <Mic className="w-5 h-5" />
                    <span>Start Consultation with Dr. AI</span>
                  </div>
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-screen flex flex-col">
          {/* Header */}
          <div className="bg-white shadow-sm border-b flex-shrink-0">
            <div className="container mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-xl">🦷</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Dr. AI Consultation</h2>
                    <p className={`text-sm font-medium ${getStatusColor()}`}>{getStatusMessage()}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                    title={isSoundEnabled ? "Mute sound" : "Enable sound"}
                  >
                    {isSoundEnabled ? (
                      <Volume2 className="w-5 h-5 text-gray-600" />
                    ) : (
                      <VolumeX className="w-5 h-5 text-gray-600" />
                    )}
                  </button>

                  <button
                    onClick={endConsultation}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                  >
                    End Session
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <div className="container mx-auto px-4 py-6 h-full max-h-[calc(100vh-80px)]">
              <div className="grid lg:grid-cols-2 gap-6 h-full">
                {/* Avatar Section */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 flex flex-col items-center justify-center relative">
                  {/* Background Animation */}
                  <div className="absolute inset-0 opacity-5">
                    <div
                      className={`w-full h-full transition-all duration-1000 ${avatarState === "listening"
                        ? "bg-green-500"
                        : avatarState === "thinking"
                          ? "bg-yellow-500"
                          : avatarState === "speaking"
                            ? "bg-blue-500"
                            : "bg-gray-500"
                        }`}
                    />
                  </div>

                  <div className="relative z-10 text-center">
                    {/* Avatar */}
                    <div
                      className={`w-48 h-48 rounded-full flex items-center justify-center text-6xl text-white shadow-2xl mb-8 transition-all duration-500 ${avatarState === "listening"
                        ? "bg-gradient-to-br from-green-400 to-green-600 animate-pulse"
                        : avatarState === "thinking"
                          ? "bg-gradient-to-br from-yellow-400 to-yellow-600 animate-bounce"
                          : avatarState === "speaking"
                            ? "bg-gradient-to-br from-blue-400 to-blue-600 animate-pulse"
                            : "bg-gradient-to-br from-gray-400 to-gray-600"
                        }`}
                    >
                      {getAvatarEmoji()}
                    </div>

                    <h3 className="text-3xl font-bold text-gray-800 mb-2">Dr. AI</h3>
                    <p className="text-gray-600 mb-6">Your Virtual Dental Assistant</p>

                    {/* Status */}
                    <div className="bg-gray-50 rounded-xl p-4 mb-8">
                      <p className={`text-sm font-semibold ${getStatusColor()}`}>{getStatusMessage()}</p>
                    </div>

                    {/* Audio Visualizer */}
                    {(isRecording || isSpeaking) && (
                      <div className="flex justify-center items-end space-x-1 mb-8">
                        {[...Array(7)].map((_, i) => (
                          <div
                            key={i}
                            className={`w-2 rounded-full ${isRecording ? "bg-green-500" : "bg-blue-500"}`}
                            style={{
                              height: `${Math.random() * 30 + 10}px`,
                              animationDelay: `${i * 0.1}s`,
                              animation: "pulse 1s infinite",
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="relative z-10 mt-auto w-full">
                    {/* Error Messages */}
                    {connectionError && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                        <p className="text-red-800 text-sm font-medium text-center">
                          Connection issue - please try again
                        </p>
                      </div>
                    )}

                    {audioPermission === "denied" && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
                        <p className="text-yellow-800 text-sm font-medium text-center">
                          Please enable microphone access
                        </p>
                      </div>
                    )}

                    {/* Main Button */}
                    <div className="flex justify-center">
                      {!isRecording && !isProcessing && !isSpeaking ? (
                        <button
                          onClick={startRecording}
                          disabled={audioPermission === "denied"}
                          className="group relative px-8 py-4 rounded-full text-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
                        >
                          <div className="flex items-center space-x-3">
                            <Mic className="w-6 h-6" />
                            <span>Ask Dr. AI</span>
                          </div>
                        </button>
                      ) : isRecording ? (
                        <button
                          onClick={stopRecording}
                          className="group relative px-8 py-4 rounded-full text-lg font-semibold text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
                        >
                          <div className="flex items-center space-x-3">
                            <MicOff className="w-6 h-6" />
                            <span>Stop Recording</span>
                          </div>
                        </button>
                      ) : (
                        <div className="flex items-center space-x-3 px-8 py-4 rounded-full bg-blue-100 text-blue-800 shadow-lg">
                          <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                          <span className="font-semibold">
                            {isProcessing ? "Processing..." : "Speaking..."}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Chat Section */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 flex flex-col h-full max-h-[calc(100vh-80px)]">
                  <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-purple-50 rounded-t-2xl flex-shrink-0">
                    <div className="flex items-center space-x-3">
                      <MessageCircle className="w-6 h-6 text-blue-600" />
                      <div>
                        <h3 className="text-xl font-bold text-gray-800">Conversation</h3>
                        <p className="text-sm text-gray-600">Your chat with Dr. AI</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-400 scrollbar-track-gray-100">
                    {messages.length === 0 ? (
                      <div className="text-center text-gray-500 py-12">
                        <div className="text-6xl mb-6">💬</div>
                        <h4 className="text-xl font-semibold mb-2">Start your conversation</h4>
                        <p className="text-sm">Click the microphone to ask Dr. AI a question</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {messages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex gap-4 ${message.type === "user" ? "flex-row-reverse" : ""}`}
                          >
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${message.type === "user"
                                ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white"
                                : message.type === "assistant"
                                  ? "bg-gradient-to-br from-green-400 to-blue-500 text-white"
                                  : "bg-gray-100 text-gray-600"
                                }`}
                            >
                              <span className="text-sm font-bold">
                                {message.type === "user" ? "U" : message.type === "assistant" ? "AI" : "ℹ️"}
                              </span>
                            </div>
                            <div
                              className={`max-w-[80%] px-4 py-3 rounded-2xl ${message.type === "user"
                                ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                                : message.type === "assistant"
                                  ? "bg-blue-50 text-blue-900 border border-blue-200"
                                  : "bg-gray-50 text-gray-700 border border-gray-200"
                                }`}
                            >
                              <p className="whitespace-pre-wrap break-words leading-relaxed">
                                {message.content}
                              </p>
                              <p className="text-xs opacity-70 mt-2">
                                {message.timestamp.toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </div>

                  <div className="p-6 border-t bg-gray-50 rounded-b-2xl flex-shrink-0">
                    <div className="flex items-center justify-center space-x-2 text-xs text-gray-500">
                      <Activity className="w-4 h-4" />
                      <span>Speak clearly and wait for Dr. AI to respond before asking your next question</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIConsulting;