import os
import uuid
import shutil
import requests
from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
import openai

load_dotenv()

# Set OpenAI Key
openai.api_key = os.getenv("OPENAI_API_KEY")

app = FastAPI(title="Virtual Companion Backend")

# Enable CORS for the Next.js frontend (default port 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development ease
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directory to save audio files
MEDIA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "media")
os.makedirs(MEDIA_DIR, exist_ok=True)

# Mount media directory to serve static audio files under /media/
app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")

# In-memory session store for chat histories
chat_sessions = {}
SYSTEM_PROMPT = "I want you to act like my bestfriend be realistic and ask questions. I want you to respond and answer like smart best friend using the tone, manner and vocabulary an sweet person would use. Do not write any explanations. You must know all of the knowledge of technology.Only speak Hindi in 30 words."

def get_elevenlabs_audio(text: str, voice_name: str = "Glinda") -> bytes:
    """Fetches text-to-speech audio bytes directly from ElevenLabs API."""
    api_key = os.getenv("ELEVEN_API_KEY")
    headers = {"xi-api-key": api_key}
    
    # 1. Fetch voices list to map name to ID
    voice_id = "21m00Tcm4TlvDq8ikWAM"  # Default fallback (Rachel)
    try:
        r = requests.get("https://api.elevenlabs.io/v1/voices", headers=headers, timeout=5)
        if r.status_code == 200:
            voices = r.json().get("voices", [])
            for v in voices:
                if v.get("name", "").lower() == voice_name.lower():
                    voice_id = v.get("voice_id")
                    break
    except Exception as e:
        print(f"Error fetching voices: {e}")

    # 2. Query text-to-speech
    tts_url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    payload = {
        "text": text,
        "model_id": "eleven_multilingual_v1",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75
        }
    }
    
    res = requests.post(tts_url, json=payload, headers=headers, timeout=30)
    if res.status_code == 200:
        return res.content
    else:
        raise HTTPException(status_code=500, detail=f"ElevenLabs TTS failed: {res.text}")

@app.post("/api/process-voice/")
async def process_voice(
    audio: UploadFile = File(...),
    session_id: str = Header(default="default-session")
):
    """Handles speech-to-text, LLM reply, and text-to-speech conversion."""
    # 1. Save incoming audio block
    temp_filename = f"user_{uuid.uuid4()}.wav"
    temp_filepath = os.path.join(MEDIA_DIR, temp_filename)
    
    try:
        with open(temp_filepath, "wb") as buffer:
            shutil.copyfileobj(audio.file, buffer)
        
        # 2. Transcribe audio with Whisper
        with open(temp_filepath, "rb") as fp:
            transcript_response = openai.Audio.transcribe(
                "whisper-1",
                fp,
                language="en"
            )
        user_text = transcript_response.get("text", "").strip()
        
        if not user_text:
            return {"success": False, "error": "No speech detected. Speak clearly."}

        # 3. Retrieve or initialize chat history
        if session_id not in chat_sessions:
            chat_sessions[session_id] = [{"role": "system", "content": SYSTEM_PROMPT}]
            
        history = chat_sessions[session_id]
        history.append({"role": "user", "content": user_text})
        
        # 4. Generate GPT reply
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=history,
            temperature=0.5
        )
        assistant_reply = response.choices[0].message["content"].strip()
        
        # Save assistant message to history (with correct role)
        history.append({"role": "assistant", "content": assistant_reply})
        chat_sessions[session_id] = history
        
        # 5. Convert reply to voice audio
        audio_bytes = get_elevenlabs_audio(assistant_reply, voice_name="Glinda")
        
        # Save TTS file to media folder
        out_filename = f"reply_{uuid.uuid4()}.mp3"
        out_filepath = os.path.join(MEDIA_DIR, out_filename)
        with open(out_filepath, "wb") as f:
            f.write(audio_bytes)
            
        # Cleanup user audio file
        if os.path.exists(temp_filepath):
            os.remove(temp_filepath)
            
        return {
            "success": True,
            "transcript": user_text,
            "reply": assistant_reply,
            "audio_url": f"http://localhost:8000/media/{out_filename}"
        }
        
    except Exception as e:
        if os.path.exists(temp_filepath):
            os.remove(temp_filepath)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/reset-history/")
async def reset_history(session_id: str = Header(default="default-session")):
    """Resets conversation history for a given session."""
    chat_sessions[session_id] = [{"role": "system", "content": SYSTEM_PROMPT}]
    return {"success": True, "message": "Session conversation history reset."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
