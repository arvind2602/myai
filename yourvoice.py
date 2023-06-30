import openai
import sounddevice as sd
import numpy as np
from scipy.io import wavfile
import tempfile
from playsound import playsound
import moviepy.editor as mp
import whisper
from elevenlabs import set_api_key
set_api_key("cc48ada1f0ef78e5aa7c5133151f201b")
model=whisper.load_model("base")


class VoiceAssistant:

    def __init__(self):
     
        # Set your OpenAI API key
        openai.api_key = "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"
        # Initialize the assistant's history
        self.history = [
                {"role": "system", "content": "Act as my personal assistant.Only speak english in 30 words."}
            ]

    def listen(self):

        print("Listening...")
        # Record the audio
        duration = 3  # Record for 3 seconds
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

        from elevenlabs import generate, play ,save

        audio = generate(
          text=xyz,
          voice="Bella",
          model="eleven_monolingual_v1"
        )
        save(audio, "welcome.mp3")


        video = mp.VideoFileClip("./anime3.mp4")
        audio = mp.AudioFileClip("welcome.mp3")
        audio_segment = audio.subclip(0, video.duration)
        synced_video = video.set_audio(audio)
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
      
