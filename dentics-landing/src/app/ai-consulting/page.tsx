"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Wrapper from "@/components/Wrapper";
import SectionHeading from "@/components/SectionHeading";
import { useState, useEffect, useRef } from "react";

const AIConsulting = () => {
  const [toothDetails, setToothDetails] = useState("");
  const [consultationStarted, setConsultationStarted] = useState(false);
  const [conversation, setConversation] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const recordingStartTime = useRef<number | null>(null);

  // Initialize AudioContext
  useEffect(() => {
    audioContext.current = new AudioContext();
    return () => {
      if (audioContext.current) {
        audioContext.current.close();
      }
    };
  }, []);

  // Start recording and buffer audio chunks
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/mp4";
      mediaRecorder.current = new MediaRecorder(stream, { mimeType });

      audioChunks.current = []; // Clear previous chunks
      recordingStartTime.current = Date.now();
      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
          console.log("Buffered audio chunk, size:", event.data.size);
        }
      };

      mediaRecorder.current.start(1000); // Collect chunks every 1000ms
      setIsRecording(true);
      setConversation((prev) => [...prev, "System: Recording started..."]);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      setConversation((prev) => [...prev, `System: Please allow microphone access.`]);
    }
  };

  // Stop recording and send audio file to API
  const stopRecording = async () => {
    if (mediaRecorder.current && mediaRecorder.current.state === "recording") {
      mediaRecorder.current.stop();
      setIsRecording(false);
      setConversation((prev) => [...prev, "System: Recording stopped."]);

      mediaRecorder.current.onstop = async () => {
        const recordingDuration = recordingStartTime.current ? (Date.now() - recordingStartTime.current) / 1000 : 0;
        if (audioChunks.current.length > 0 && recordingDuration >= 2) { // Minimum 2 seconds
          const audioBlob = new Blob(audioChunks.current, { type: mediaRecorder.current!.mimeType });
          console.log("Sending audio file to API, size:", audioBlob.size);

          setIsProcessing(true);
          try {
            const formData = new FormData();
            formData.append("file", audioBlob, "audio.webm");

            const response = await fetch("http://localhost:8000/transcribe", {
              method: "POST",
              body: formData,
            });

            if (!response.ok) {
              throw new Error(`API error: ${response.statusText}`);
            }

            const result = await response.json();
            console.log("API response:", result);

            if (result.transcription) {
              setConversation((prev) => [
                ...prev,
                `You: ${result.transcription}`,
                `Assistant: ${result.ai_response}`,
              ]);
              // Play the audio response
              const audioData = new Uint8Array(
                result.audio.match(/.{1,2}/g).map((byte: string) => parseInt(byte, 16))
              );
              const audioBlob = new Blob([audioData], { type: "audio/mp3" });
              const audioBuffer = await audioContext.current!.decodeAudioData(await audioBlob.arrayBuffer());
              const source = audioContext.current!.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(audioContext.current!.destination);
              source.start();
            } else {
              setConversation((prev) => [...prev, `Assistant: ${result.ai_response}`]);
            }
          } catch (error) {
            console.error("Error sending audio to API:", error);
            setConversation((prev) => [...prev, `System: Failed to process audio: ${error}`]);
          } finally {
            setIsProcessing(false);
            audioChunks.current = [];
            recordingStartTime.current = null;
          }
        } else {
          console.log("No audio chunks recorded or recording too short");
          setConversation((prev) => [...prev, "System: Recording too short or no audio, please try again."]);
          audioChunks.current = [];
          recordingStartTime.current = null;
        }
      };
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (toothDetails.trim()) {
      setConsultationStarted(true);
      setConversation((prev) => [...prev, `You: ${toothDetails}`]);
      startRecording();
    }
  };

  return (
    <>
      <Header />
      <Wrapper className={`py-20 ${consultationStarted ? "hidden" : ""}`}>
        <SectionHeading
          direction="left"
          title={
            <>
              AI <span className="text-accent">Consulting</span>
            </>
          }
          subtitle={
            <>
              Get instant <span className="text-accent">dental advice</span>
            </>
          }
        />
      </Wrapper>
      <Wrapper>
        <div className={`mt-10 ${!consultationStarted ? "flex flex-col lg:flex-row gap-10" : "h-screen w-full"}`}>
          <div className={`${!consultationStarted ? "flex-1" : "w-full h-full"}`}>
            {!consultationStarted ? (
              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <label htmlFor="toothDetails" className="text-lg font-medium">
                  Please describe your tooth details or concerns:
                </label>
                <textarea
                  id="toothDetails"
                  className="min-h-[15rem] px-6 py-3 border border-[#888888CC] placeholder:text-[#888888CC] rounded-lg"
                  placeholder="e.g., I have a sharp pain in my upper left molar when I drink cold water."
                  value={toothDetails}
                  onChange={(e) => setToothDetails(e.target.value)}
                  required
                />
                <button
                  type="submit"
                  className="px-8 py-4 rounded-lg select-none text-white bg-accent hover:opacity-80 transition duration-150"
                >
                  Start Consultation
                </button>
              </form>
            ) : (
              <div className="relative w-full h-screen overflow-hidden">
                <video
                  src="/doctor.mp4"
                  autoPlay
                  loop
                  muted
                  className="absolute top-0 left-0 w-full h-full object-cover"
                />
                <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center bg-black bg-opacity-50 text-white text-2xl p-4 overflow-y-auto">
                  {conversation.map((message, index) => (
                    <p key={index} className="text-lg text-left w-full">{message}</p>
                  ))}
                  <div className="mt-4 flex flex-col items-center gap-4">
                    {isRecording && <p className="text-yellow-500">Listening...</p>}
                    {isProcessing && !isRecording && <p className="text-blue-500">Processing...</p>}
                    {!isRecording ? (
                      <button
                        onClick={startRecording}
                        className="px-8 py-4 rounded-lg select-none text-white bg-accent hover:opacity-80 transition duration-150"
                      >
                        Start Speaking
                      </button>
                    ) : (
                      <button
                        onClick={stopRecording}
                        className="px-8 py-4 rounded-lg select-none text-white bg-red-500 hover:opacity-80 transition duration-150"
                      >
                        Stop Speaking
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Wrapper>
      <Footer />
    </>
  );
};

export default AIConsulting;