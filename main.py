import openai
import sounddevice as sd
import numpy as np
from scipy.io import wavfile
import tempfile
import moviepy.editor as mp
import whisper
model=whisper.load_model("base")
from elevenlabs import set_api_key
from dotenv import load_dotenv
import os
load_dotenv()

set_api_key(os.getenv("ELEVEN_API_KEY"))

class VoiceAssistant:
    def __init__(self):
     
        # Set your OpenAI API key
        openai.api_key = os.getenv("OPENAI_API_KEY")
        # Initialize the assistant's history
        self.history = [
                {"role": "system", "content": "I want you to act like my bestfriend be realistic and ask questions. I want you to respond and answer like smart best friend using the tone, manner and vocabulary an sweet person would use. Do not write any explanations. You must know all of the knowledge of technology.Only speak Hindi in 30 words."}
            ]

    def listen(self):

        """
        Records audio from the user and transcribes it.
        And then returns the text.

        """
        print("Listening...")
        # Record the audio until the user stops
        duration = 3  
        fs = 44100  # Sample rate
        audio = sd.rec(int(duration * fs), samplerate=fs, channels=1, dtype=np.int16)
        sd.wait()

        # Save the NumPy array to a temporary wav file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_wav_file:
            wavfile.write(temp_wav_file.name, fs, audio)

            # Use the temporary wav file in the OpenAI API
            transcript = openai.Audio.transcribe("whisper-1", temp_wav_file,language="en")

        print(f"User: {transcript['text']}")
        return transcript['text']
    
  
    def think(self, text):

        # Add the user's input to the assistant's history
        self.history.append({"role": "user", "content": text})
        # Send the conversation to the GPT API
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=self.history,
            temperature=0.5
        )
        # Extract the assistant's response from the API responses
        message = dict(response.choices[0])['message']['content']
        self.history.append({"role": "system", "content": message})
        print('Assistant: ', message)
        return message
    

    def speak(self,xyz):
        # Converts text to speech and plays it.

        from elevenlabs import generate ,save
        audio = generate(
          text=xyz,
          voice="Glinda",
          model="eleven_multilingual_v1"
        )
        save(audio, "output.mp3")


        video = mp.VideoFileClip("./video_templates/ue.mp4")
        audio = mp.AudioFileClip("output.mp3")
        synced_video = video.set_audio(audio)
        synced_video = synced_video.set_duration(audio.duration)
 
        if audio.duration > video.duration:
            video = mp.concatenate_videoclips([video] * int(np.ceil(audio.duration / video.duration)))
            synced_video = video.set_audio(audio)
            synced_video = synced_video.set_duration(audio.duration)

        synced_video.write_videofile("output.mp4")
        clip=mp.VideoFileClip("output.mp4")
        clip.preview(fps=24)

if __name__ == "__main__":
    assistant = VoiceAssistant()

    while True:
        text = assistant.listen()

        if "goodbye" in text.strip().lower():
            print("Assistant: Goodbye! Have a great day!")
            assistant.speak("Goodbye! Have a great day!")
            break
        
        response = assistant.think(text)
        assistant.speak(response)
      
