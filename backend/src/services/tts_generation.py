import logging
from functools import lru_cache
from elevenlabs import ElevenLabs

# Configure logging for this module
logger = logging.getLogger(__name__)

class TTSGenerator:
    """
    Handles text-to-speech (TTS) generation using ElevenLabs.
    """
    def __init__(self, elevenlabs_client: ElevenLabs):
        """
        Initializes the TTSGenerator with an ElevenLabs client.

        Args:
            elevenlabs_client: An instance of ElevenLabs for TTS conversion.
        """
        self.elevenlabs_client = elevenlabs_client

    @lru_cache(maxsize=100) # Cache up to 100 unique text-to-speech conversions
    def _cached_convert(self, text: str, voice_id: str) -> bytes:
        """
        Internal method to convert text to speech with caching.
        This method is decorated with lru_cache to store results of recent conversions.
        """
        logger.info(f"Converting text to speech (cached): '{text[:50]}...'")
        return self.elevenlabs_client.text_to_speech.convert(
            voice_id=voice_id,
            text=text,
            model_id="eleven_multilingual_v2" # Specify the model for consistent results
        )

    async def generate_tts(self, text: str, voice_id: str = "JBFqnCBsd6RMkjVDRZzb") -> bytes:
        """
        Generates audio from text using ElevenLabs.

        Args:
            text: The text to convert to speech.
            voice_id: The ID of the voice to use for synthesis. Defaults to a specific voice.

        Returns:
            The generated audio data as bytes.

        Raises:
            Exception: If an error occurs during the ElevenLabs TTS API call.
        """
        try:
            # The _cached_convert method returns an async generator, so we need to consume it.
            audio_stream = self._cached_convert(text, voice_id)
            audio_chunks = [chunk async for chunk in audio_stream]
            audio_data = b''.join(audio_chunks)
            logger.info(f"Successfully generated TTS audio for text: '{text[:50]}...'")
            return audio_data
        except Exception as e:
            logger.error(f"ElevenLabs TTS generation error: {str(e)}")
            raise Exception(f"Failed to generate TTS audio: {str(e)}")