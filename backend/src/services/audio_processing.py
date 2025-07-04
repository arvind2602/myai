import wave
import tempfile
import os
import shutil
import subprocess
import logging
from pydub import AudioSegment
from openai import AsyncOpenAI

# Configure logging for this module
logger = logging.getLogger(__name__)

class AudioProcessor:
    """
    Handles audio processing tasks including WebM to WAV conversion,
    audio validation, and transcription using OpenAI Whisper.
    """
    def __init__(self, openai_client: AsyncOpenAI):
        """
        Initializes the AudioProcessor with an OpenAI client.

        Args:
            openai_client: An instance of AsyncOpenAI for transcription.
        """
        self.openai_client = openai_client

    async def transcribe_audio(self, audio_data: bytes) -> str:
        transcribed_text = "."
        fs = 16000

        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_webm:
                temp_webm.write(audio_data)
                temp_webm.flush()
                shutil.copy(temp_webm.name, "debug_audio.webm")
                logger.info(f"Saved WebM for debugging: debug_audio.webm")

                # Check file size
                file_size = os.path.getsize(temp_webm.name)
                if file_size < 100:
                    logger.error(f"WebM file too small: {file_size} bytes")
                    raise Exception("WebM file too small or empty")

            # Validate WebM file integrity
            try:
                result = subprocess.run(
                    ["ffmpeg", "-i", temp_webm.name, "-f", "null", "-"],
                    capture_output=True,
                    text=True,
                    check=True
                )
                logger.info(f"WebM file validated successfully: {result.stderr}")
            except subprocess.CalledProcessError as e:
                logger.error(f"Invalid WebM file detected: {e.stderr}")
                raise Exception(f"Invalid WebM file: {e.stderr}")

            # Convert WebM to WAV
            try:
                audio = AudioSegment.from_file(temp_webm.name, format="webm")
                logger.info(f"WebM loaded: duration={audio.duration_seconds}s, channels={audio.channels}, sample_rate={audio.frame_rate}")
                audio = audio.set_channels(1).set_frame_rate(fs)

                with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_wav:
                    audio.export(temp_wav.name, format="wav")

                with wave.open(temp_wav.name, 'rb') as wav_file:
                    if wav_file.getnframes() == 0:
                        logger.error("Invalid WAV file: No audio frames found.")
                        raise Exception("Invalid WAV file")

                try:
                    with open(temp_wav.name, "rb") as audio_file:
                        transcript = await self.openai_client.audio.transcriptions.create(
                            model="whisper-1",
                            file=audio_file
                        )
                    transcribed_text = transcript.text
                    if not transcribed_text:
                        logger.warning("Transcription empty: No text detected in audio.")
                    else:
                        logger.info(f"Transcription successful: '{transcribed_text}'")
                except Exception as e:
                    logger.error(f"OpenAI transcription API error: {str(e)}")
                    raise Exception(f"OpenAI transcription error: {str(e)}")
                finally:
                    if os.path.exists(temp_wav.name):
                        os.unlink(temp_wav.name)
            except Exception as e:
                logger.error(f"Audio conversion (WebM to WAV) error: {str(e)}")
                if 'temp_wav' in locals() and os.path.exists(temp_wav.name):
                    shutil.copy(temp_wav.name, "debug_audio.wav")
                    logger.info(f"Saved WAV for debugging: debug_audio.wav")
                transcribed_text = "."
            finally:
                if os.path.exists(temp_webm.name):
                    os.unlink(temp_webm.name)
        except Exception as e:
            logger.error(f"An unexpected error occurred during audio processing: {str(e)}")
            transcribed_text = "."

        return transcribed_text