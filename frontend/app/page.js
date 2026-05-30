"use client";

import { useState, useRef, useEffect } from 'react';

export default function Home() {
  const [avatar, setAvatar] = useState('ue.mp4');
  const [status, setStatus] = useState('Ready');
  const [transcript, setTranscript] = useState('Click the microphone and start speaking to your companion...');
  const [isRecording, setIsRecording] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(0.8);
  const [isListeningState, setIsListeningState] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const videoPlayerRef = useRef(null);
  const speechPlayerRef = useRef(null);

  // Synchronize playback speed of video with visual states
  useEffect(() => {
    if (!videoPlayerRef.current) return;
    
    switch (status) {
      case 'Listening':
        setPlaybackRate(1.0);
        setIsListeningState(true);
        break;
      case 'Thinking':
        setPlaybackRate(1.5);
        setIsListeningState(false);
        break;
      case 'Speaking':
        setPlaybackRate(1.0);
        setIsListeningState(false);
        break;
      default:
        setPlaybackRate(0.8); // Relaxed idle speed
        setIsListeningState(false);
    }
  }, [status]);

  useEffect(() => {
    if (videoPlayerRef.current) {
      videoPlayerRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Handle avatar select change
  const handleAvatarChange = (e) => {
    setAvatar(e.target.value);
    if (videoPlayerRef.current) {
      videoPlayerRef.current.load();
      videoPlayerRef.current.play().catch(err => console.log("Video autoplay blocked:", err));
    }
  };

  // Start Audio Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await sendAudioToBackend(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setStatus('Listening');
      setTranscript('Listening to you...');
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Please allow microphone permissions to chat.');
    }
  };

  // Stop Audio Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setStatus('Thinking');
    }
  };

  // Send audio payload to FastAPI backend
  const sendAudioToBackend = async (audioBlob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'user_voice.wav');

    try {
      const response = await fetch('http://localhost:8000/api/process-voice/', {
        method: 'POST',
        body: formData,
        headers: {
          'Session-Id': 'companion-web-session'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setTranscript(
          <>
            <strong>You:</strong> {data.transcript}<br /><br />
            <strong>Companion:</strong> {data.reply}
          </>
        );
        playSpeech(data.audio_url);
      } else {
        setTranscript(`Error: ${data.error || 'Failed to process audio'}`);
        setStatus('Ready');
      }
    } catch (error) {
      console.error('Error sending audio:', error);
      setTranscript('Network error. Make sure your FastAPI server is running on port 8000.');
      setStatus('Ready');
    }
  };

  // Play Elevenlabs audio reply and sync avatar
  const playSpeech = (audioUrl) => {
    if (!speechPlayerRef.current) return;
    
    speechPlayerRef.current.src = audioUrl;
    
    speechPlayerRef.current.onplay = () => {
      setStatus('Speaking');
    };
    
    speechPlayerRef.current.onended = () => {
      setStatus('Ready');
    };

    speechPlayerRef.current.onerror = () => {
      console.error("Audio playback error");
      setStatus('Ready');
    };

    speechPlayerRef.current.play().catch(e => {
      console.error("Audio playback blocked by browser:", e);
      setStatus('Ready');
    });
  };

  // Clear chat conversation context
  const resetChat = async () => {
    if (confirm('Are you sure you want to clear chat history?')) {
      try {
        const res = await fetch('http://localhost:8000/api/reset-history/', {
          method: 'POST',
          headers: {
            'Session-Id': 'companion-web-session'
          }
        });
        const data = await res.json();
        if (data.success) {
          setTranscript("Conversation history has been reset. Speak to your companion.");
          setStatus('Ready');
        }
      } catch (e) {
        console.error('Reset failed:', e);
      }
    }
  };

  return (
    <div style={styles.appContainer}>
      <header>
        <h1 style={styles.title}>My AI Bestie</h1>
        <p style={styles.subtitle}>Your interactive personalized companion</p>
      </header>

      {/* Dynamic Visual Avatar */}
      <div style={{
        ...styles.avatarContainer,
        boxShadow: isListeningState ? '0 0 35px #00f0ff' : '0 0 30px rgba(138, 43, 226, 0.3)'
      }}>
        <div style={styles.avatarWrapper}>
          <video 
            ref={videoPlayerRef}
            style={styles.avatarVideo}
            loop 
            muted 
            autoplay 
            playsInline
          >
            <source src={`/videos/${avatar}`} type="video/mp4" />
            Your browser does not support HTML5 video.
          </video>
        </div>
      </div>

      <div style={styles.statusDisplay}>{status}</div>

      {/* Chat Transcript Bubble */}
      <div style={styles.transcriptBubble}>
        {transcript}
      </div>

      <div style={styles.controls}>
        <button onClick={resetChat} style={styles.btnReset}>Reset Chat</button>
        
        <button 
          onClick={isRecording ? stopRecording : startRecording}
          style={{
            ...styles.btnRecord,
            backgroundColor: isRecording ? '#ff0000' : 'initial',
            backgroundImage: isRecording ? 'none' : 'linear-gradient(135deg, #ff007f, #8a2be2)',
            boxShadow: isRecording ? '0 0 30px rgba(255, 0, 0, 0.9)' : '0 8px 24px rgba(255, 0, 127, 0.3)'
          }}
          aria-label="Record voice"
        >
          <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
          </svg>
        </button>
      </div>

      <div style={styles.characterSelect}>
        <label htmlFor="companion-model">Choose Avatar:</label>
        <select 
          id="companion-model" 
          value={avatar} 
          onChange={handleAvatarChange}
          style={styles.select}
        >
          <option value="ue.mp4">Default (UE)</option>
          <option value="anime1.mp4">Anime Girl 1</option>
          <option value="anime3.mp4">Anime Girl 2</option>
        </select>
      </div>

      {/* Hidden audio element for TTS reply */}
      <audio ref={speechPlayerRef} style={{ display: 'none' }}></audio>
    </div>
  );
}

// Inline premium styles
const styles = {
  appContainer: {
    width: '90%',
    maxWidth: '480px',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '24px',
    padding: '30px',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 50px rgba(138, 43, 226, 0.4)',
    textAlign: 'center',
    position: 'relative',
    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  title: {
    fontSize: '2rem',
    fontWeight: '800',
    background: 'linear-gradient(to right, #ffffff, #8a2be2, #00f0ff)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: '8px',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '0.9rem',
    color: '#8e8e93',
    marginBottom: '25px',
  },
  avatarContainer: {
    position: 'relative',
    width: '200px',
    height: '200px',
    margin: '0 auto 30px',
    borderRadius: '50%',
    padding: '5px',
    background: 'linear-gradient(135deg, #8a2be2, #00f0ff)',
    display: 'flex',
    alignItems: 'center',
    justifycontent: 'center',
    transition: 'all 0.5s ease',
  },
  avatarWrapper: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    overflow: 'hidden',
    background: '#110d21',
    position: 'relative',
  },
  avatarVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'opacity 0.3s ease',
  },
  statusDisplay: {
    fontSize: '0.95rem',
    minHeight: '24px',
    color: '#00f0ff',
    fontWeight: '600',
    marginBottom: '15px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  transcriptBubble: {
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '16px',
    padding: '15px',
    marginBottom: '25px',
    maxHeight: '120px',
    overflowY: 'auto',
    textAlign: 'left',
    fontSize: '0.95rem',
    color: '#ddd',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px',
    marginBottom: '20px',
  },
  btnRecord: {
    width: '70px',
    height: '70px',
    borderRadius: '50%',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '1.8rem',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  },
  btnReset: {
    padding: '10px 20px',
    borderRadius: '12px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: '#f5f5f7',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  characterSelect: {
    marginTop: '15px',
    fontSize: '0.85rem',
    color: '#8e8e93',
  },
  select: {
    background: '#110d21',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: '#f5f5f7',
    padding: '6px 12px',
    borderRadius: '8px',
    marginLeft: '8px',
    outline: 'none',
    cursor: 'pointer',
  }
};
