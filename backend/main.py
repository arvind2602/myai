import logging
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from fastapi.responses import JSONResponse

from src.config import OPENAI_API_KEY
from src.services.audio_processing import AudioProcessor
from src.services.ai_interaction import AIInteractionService

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize FastAPI application
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Initialize API client
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)

# Initialize service layers
audio_processor = AudioProcessor(openai_client=openai_client)
ai_system_message = "Act as a professional dentist. I’ll ask you questions about my teeth, and you must answer clearly and accurately in under 50 words per reply."
ai_interaction_service = AIInteractionService(openai_client=openai_client, system_message=ai_system_message)

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...), initial_message: str = None):
    """
    API endpoint to receive an audio file, transcribe it, and get an AI response.

    Args:
        file (UploadFile): The audio file uploaded by the client (WebM format).
        initial_prompt (str, optional): Initial prompt for transcription (if any).
        initial_message (str, optional): Initial user state or context to provide to the AI.

    Returns:
        JSONResponse: A JSON object containing the transcription and AI response.

    Raises:
        HTTPException: If any error occurs during audio processing or AI interaction.
    """
    try:
        logger.info(f"Received audio file: {file.filename}, size: {file.size} bytes")
        audio_data = await file.read()

        # Step 1: Transcribe the audio
        transcribed_text = await audio_processor.transcribe_audio(audio_data)
        if not transcribed_text:
            return JSONResponse(
                status_code=200,
                content={"transcription": "", "ai_response": "No speech detected, please try again."}
            )

        # Step 2: Check for session-ending keywords
        if "goodbye" in transcribed_text.strip().lower():
            ai_response = "अलविदा! शुभ दिन हो!"  # Farewell message in Hindi
            ai_interaction_service.reset_history()
            return JSONResponse(
                status_code=200,
                content={
                    "transcription": transcribed_text,
                    "ai_response": ai_response
                }
            )

        # Step 3: Get AI response with initial_message (if provided)
        ai_response = await ai_interaction_service.get_ai_response(transcribed_text, initial_message=initial_message)

        # Return transcription and AI response
        return JSONResponse(
            status_code=200,
            content={
                "transcription": transcribed_text,
                "ai_response": ai_response
            }
        )
    except Exception as e:
        logger.error(f"Failed to process audio request: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Audio processing failed: {str(e)}")