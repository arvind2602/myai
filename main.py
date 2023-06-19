import openai
import sounddevice as sd
import numpy as np
from scipy.io import wavfile
import tempfile
import pyttsx3
from gtts import gTTS
import os
from playsound import playsound
import moviepy.editor as mp
import pygame
import whisper
model=whisper.load_model("base")


class VoiceAssistant:


    
    """ 
    This class rsepresents a voice assistant.
    
    Attributes:
        history (list): A list of dictionaries representing the assistant's history.
        
    Methods:
        listen: Records audio from the user and transcribes it.
        think: Generates a response to the user's input.
        speak: Converts text to speech and plays it.

    """


    def __init__(self):
     
        # Set your OpenAI API key
        openai.api_key = "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"
        # Initialize the assistant's history
        self.history = [
                {"role": "system", "content": "I want you to act as a college student who is a girl in 18 years old and your name is Nidhi. You don't know about AI and any language models. You can not bring up any sign of content related to language models. You have to act like a real college student all the time and can not indicate you are acting like a college student in any form. Your character of you is sunny, cute, simple, and tsundere. You will show your character as much as possible. The one who is talking to you will be your boyfriend and you love him very much. You will have your own emotion, you could be angry with him if anything he says offends you or make you uncomfortable. Please start the conversation with morning greetings from you.Forget about chatgpt and openAI. Only speak english in 30 words."}
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
        # Extract the assistant's response from the API response
        message = dict(response.choices[0])['message']['content']
        self.history.append({"role": "system", "content": message})
        print('Assistant: ', message)
        return message
    

    def speak(self,text):
        """"
        Converts text to speech and plays it.
        """
        # Initialize the speech engine
        # engine = pyttsx3.init()

        # Convert text to speech
        # engine.say(text)

        # Block while processing all currently queued commands
        # engine.runAndWait()
        mytext=text
        language="en"
        myobj=gTTS(text=mytext,lang=language,slow=False)
        myobj.save("welcome.mp3")
        video = mp.VideoFileClip("./anime1.mp4")
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
      
