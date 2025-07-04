import asyncio
import wave
import tempfile
import os
from fastapi import FastAPI, File, UploadFile, HTTPException
from openai import AsyncOpenAI
from elevenlabs import ElevenLabs
from pydub import AudioSegment
from src.config import OPENAI_API_KEY, ELEVEN_API_KEY
from functools import lru_cache
import logging
import subprocess
from fastapi.responses import JSONResponse
import io

# Configure logging to show only INFO and above (no DEBUG)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI()

class VoiceAssistant:
    def __init__(self):
        self.openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        self.elevenlabs_client = ElevenLabs(api_key=ELEVEN_API_KEY)
        self.history = [
            {"role": "system", "content": "I want you to act like my best friend, be realistic and ask questions. Respond in Hindi, sweet tone, max 30 words."}
        ]
        self.max_history = 5

    async def listen(self, audio_data: bytes):
        if len(audio_data) < 100:  # Skip very small files
            logger.warning("Audio file too small, skipping")
            return ""

        fs = 16000  # Sample rate
        try:
            # Save WebM to temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_webm:
                temp_webm.write(audio_data)
                temp_webm.flush()
                # Save a copy for debugging
                import shutil
                shutil.copy(temp_webm.name, "debug_audio.webm")
                logger.info(f"Saved WebM for debugging: debug_audio.webm")

                # Validate WebM file with ffmpeg
                try:
                    result = subprocess.run(
                        ["ffmpeg", "-i", temp_webm.name, "-f", "null", "-"],
                        capture_output=True,
                        text=True,
                        check=True
                    )
                    logger.info("WebM file validated successfully")
                except subprocess.CalledProcessError as e:
                    logger.error(f"Invalid WebM file: {e.stderr}")
                    raise Exception(f"Invalid WebM file: {e.stderr}")

                # Convert WebM to WAV
                try:
                    audio = AudioSegment.from_file(temp_webm.name, format="webm")
                    audio = audio.set_channels(1).set_frame_rate(fs)

                    # Save to WAV for transcription
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_wav:
                        audio.export(temp_wav.name, format="wav")

                        # Validate WAV file
                        with wave.open(temp_wav.name, 'rb') as wav_file:
                            if wav_file.getnframes() == 0:
                                logger.error("Invalid WAV file: No audio frames")
                                raise Exception("Invalid WAV file")

                        # Transcribe with OpenAI Whisper (auto-detect language)
                        try:
                            with open(temp_wav.name, "rb") as audio_file:
                                transcript = await self.openai_client.audio.transcriptions.create(
                                    model="whisper-1",
                                    file=audio_file
                                )
                            transcribed_text = transcript.text
                            if not transcribed_text:
                                logger.warning("Transcription empty: No text detected in audio")
                            else:
                                logger.info(f"Transcription successful: {transcribed_text}")
                            return transcribed_text
                        except Exception as e:
                            logger.error(f"OpenAI transcription error: {str(e)}")
                            raise Exception(f"OpenAI transcription error: {str(e)}")
                        finally:
                            if os.path.exists(temp_wav.name):
                                os.unlink(temp_wav.name)
                except Exception as e:
                    logger.error(f"Audio conversion error: {str(e)}")
                    # Save WAV for debugging if conversion succeeded
                    if 'temp_wav' in locals() and os.path.exists(temp_wav.name):
                        shutil.copy(temp_wav.name, "debug_audio.wav")
                        logger.info(f"Saved WAV for debugging: debug_audio.wav")
                    raise Exception(f"Audio conversion error: {str(e)}")
                finally:
                    if os.path.exists(temp_webm.name):
                        os.unlink(temp_webm.name)
        except Exception as e:
            logger.error(f"Error in listen: {str(e)}")
            raise

    async def think(self, text):
        self.history.append({"role": "user", "content": text})
        if len(self.history) > self.max_history:
            self.history = [self.history[0]] + self.history[-self.max_history + 1:]
        try:
            response = await self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=self.history,
                temperature=0.5
            )
            message = response.choices[0].message.content
            self.history.append({"role": "system", "content": message})
            logger.info(f"Assistant response: {message}")
            return message
        except Exception as e:
            logger.error(f"OpenAI chat error: {str(e)}")
            raise Exception(f"OpenAI chat error: {str(e)}")

    @lru_cache(maxsize=100)
    def cache_tts(self, text, voice_id):
        return self.elevenlabs_client.text_to_speech.convert(
            voice_id=voice_id,
            text=text,
            model_id="eleven_multilingual_v2"
        )

    async def speak(self, text):
        try:
            audio_stream = self.cache_tts(text, "JBFqnCBsd6RMkjVDRZzb")
            audio_chunks = [chunk async for chunk in audio_stream]
            audio_data = b''.join(audio_chunks)
            logger.info(f"Generated TTS audio for text: {text}")
            return audio_data
        except Exception as e:
            logger.error(f"Speak error: {str(e)}")
            raise Exception(f"Speak error: {str(e)}")

assistant = VoiceAssistant()

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    try:
        logger.info(f"Received audio file: {file.filename}, size: {file.size} bytes")
        audio_data = await file.read()
        
        # Transcribe audio
        transcribed_text = await assistant.listen(audio_data)
        if not transcribed_text:
            return JSONResponse(
                status_code=200,
                content={"transcription": "", "ai_response": "No speech detected, please try again."}
            )

        # Check for goodbye to end session
        if "goodbye" in transcribed_text.strip().lower():
            ai_response = "अलविदा! शुभ दिन हो!"
            audio_data = await assistant.speak(ai_response)
            return JSONResponse(
                status_code=200,
                content={
                    "transcription": transcribed_text,
                    "ai_response": ai_response,
                    "audio": audio_data.hex()  # Send audio as hex string
                }
            )

        # Generate AI response and TTS audio
        ai_response = await assistant.think(transcribed_text)
        audio_data = await assistant.speak(ai_response)
        
        return JSONResponse(
            status_code=200,
            content={
                "transcription": transcribed_text,
                "ai_response": ai_response,
                "audio": audio_data.hex()  # Send audio as hex string
            }
        )
    except Exception as e:
        logger.error(f"Failed to process audio: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Audio processing failed: {str(e)}")