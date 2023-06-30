import openai
import sounddevice as sd
import numpy as np
from scipy.io import wavfile
import tempfile
from playsound import playsound
import moviepy.editor as mp
import whisper
model=whisper.load_model("base")
from elevenlabs import set_api_key
set_api_key("")

class VoiceAssistant:
    def __init__(self):
     
        # Set your OpenAI API key
        openai.api_key = ""
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

        """
        Generates a response to the user's input.
        """
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
        """"
        Converts text to speech and plays it.
        """
        # Initialize the speech engine
        # engine = pyttsx3.init()

        # Convert text to speech
        # engine.say(text)

        # Block while processing all currently queued commands
        # engine.runAndWait()
        # mytext=text
        # language="en"
        # myobj=gTTS(text=mytext,lang=language,slow=False)
        # myobj.save("welcome.mp3")
        from elevenlabs import generate ,save

        audio = generate(
          text=xyz,
          voice="Josh",
          model="eleven_multilingual_v1"
        )
        save(audio, "welcome.mp3")


        video = mp.VideoFileClip("./ue.mp4")
        audio = mp.AudioFileClip("welcome.mp3")
        audio_segment = audio.subclip(0, video.duration)
        video_segment = audio.subclip(0, audio.duration)
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
      
