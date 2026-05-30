import os
import uuid
import requests
from django.shortcuts import render
from django.http import JsonResponse
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from dotenv import load_dotenv
import openai

load_dotenv()

# Set OpenAI Key
openai.api_key = os.getenv("OPENAI_API_KEY")

# Standard system prompt from original main.py
SYSTEM_PROMPT = "I want you to act like my bestfriend be realistic and ask questions. I want you to respond and answer like smart best friend using the tone, manner and vocabulary an sweet person would use. Do not write any explanations. You must know all of the knowledge of technology.Only speak Hindi in 30 words."

def index(request):
    """Serves the main single-page application."""
    # Ensure media directory exists
    os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
    # Ensure static directory exists
    os.makedirs(settings.STATICFILES_DIRS[0], exist_ok=True)
    return render(request, 'index.html')

def get_elevenlabs_audio(text, voice_name="Glinda"):
    """Queries ElevenLabs API directly using requests to avoid SDK version incompatibilities."""
    api_key = os.getenv("ELEVEN_API_KEY")
    headers = {"xi-api-key": api_key}
    
    # 1. Fetch voices to map voice name to ID
    voice_id = "21m00Tcm4TlvDq8ikWAM" # Default fallback (Rachel)
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

    # 2. Call TTS Generation Endpoint
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
        raise Exception(f"ElevenLabs API error (status {res.status_code}): {res.text}")

@csrf_exempt
def process_voice(request):
    """Processes incoming audio file from the user:
    1. Transcribes with OpenAI Whisper API.
    2. Sends context to GPT.
    3. Converts response to voice with ElevenLabs.
    4. Returns text and audio URL.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST method is allowed'}, status=405)
    
    audio_file = request.FILES.get('audio')
    if not audio_file:
        return JsonResponse({'error': 'No audio file provided'}, status=400)
    
    # 1. Save uploaded audio to a temporary file
    temp_filename = f"user_{uuid.uuid4()}.wav"
    temp_filepath = os.path.join(settings.MEDIA_ROOT, temp_filename)
    
    try:
        with open(temp_filepath, 'wb+') as destination:
            for chunk in audio_file.chunks():
                destination.write(chunk)
        
        # 2. Transcribe the file using OpenAI Whisper API
        with open(temp_filepath, 'rb') as fp:
            transcript_response = openai.Audio.transcribe(
                "whisper-1",
                fp,
                language="en"
            )
        user_text = transcript_response.get('text', '').strip()
        
        if not user_text:
            return JsonResponse({
                'success': False,
                'error': 'No speech detected. Please speak clearly.'
            })
            
        # 3. Retrieve or initialize chat history from Django Session
        history = request.session.get('history', [
            {"role": "system", "content": SYSTEM_PROMPT}
        ])
        
        # Append User message
        history.append({"role": "user", "content": user_text})
        
        # 4. Generate GPT reply
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=history,
            temperature=0.5
        )
        assistant_reply = response.choices[0].message['content'].strip()
        
        # Append Assistant message (with the correct 'assistant' role)
        history.append({"role": "assistant", "content": assistant_reply})
        
        # Store back in session
        request.session['history'] = history
        
        # 5. Generate Text-to-Speech via ElevenLabs
        audio_data = get_elevenlabs_audio(assistant_reply, voice_name="Glinda")
        
        # Save output mp3
        out_filename = f"reply_{uuid.uuid4()}.mp3"
        out_filepath = os.path.join(settings.MEDIA_ROOT, out_filename)
        with open(out_filepath, 'wb') as f:
            f.write(audio_data)
        
        # Cleanup temporary uploaded user file
        if os.path.exists(temp_filepath):
            os.remove(temp_filepath)
            
        audio_url = f"{settings.MEDIA_URL}{out_filename}"
        
        return JsonResponse({
            'success': True,
            'transcript': user_text,
            'reply': assistant_reply,
            'audio_url': audio_url
        })
        
    except Exception as e:
        # Cleanup temp file in case of failure
        if os.path.exists(temp_filepath):
            os.remove(temp_filepath)
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
def reset_history(request):
    """Resets the chat conversation history in the session."""
    request.session['history'] = [{"role": "system", "content": SYSTEM_PROMPT}]
    return JsonResponse({'success': True, 'message': 'Conversation history reset.'})
