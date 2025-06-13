
import asyncio
import os
import time
import numpy as np
import sounddevice as sd
import webrtcvad
import wave
from scipy.io import wavfile
from openai import AsyncOpenAI
from elevenlabs import ElevenLabs, stream as eleven_stream 
from dotenv import load_dotenv
import glob
import ffmpeg
import moviepy.editor as mp
import tempfile

load_dotenv()

class VoiceAssistant:
    def __init__(self):
        self.openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.elevenlabs_client = ElevenLabs(api_key=os.getenv("ELEVEN_API_KEY"))
        self.history = [
            {"role": "system", "content": "I want you to act like my best friend, be realistic and ask questions. Respond in Hindi, sweet tone, max 30 words."}
        ]
        self.max_history = 5
        self.looping_video = self.pre_render_video()

    def pre_render_video(self):
        png_files = sorted(glob.glob("./png_sequence/*.png"))
        if not png_files:
            raise FileNotFoundError("No PNG files found in ./png_sequence/")
        frame_duration = 0.1
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp_video:
            try:
                stream = (
                    ffmpeg.input("./png_sequence/*.png", pattern_type="glob", framerate=1/frame_duration)
                    .output(temp_video.name, format="mp4", vcodec="libx264", pix_fmt="yuv420p", loop=0)
                    .run(overwrite_output=True)
                )
                return temp_video.name
            except ffmpeg.Error as e:
                raise Exception(f"FFmpeg error in pre_render_video: {e.stderr.decode()}")

    async def listen(self):
        print("Listening...")
        fs = 16000
        vad = webrtcvad.Vad(3)
        frame_duration = 0.03
        frame_size = int(fs * frame_duration)
        audio_buffer = []

        stream = sd.InputStream(samplerate=fs, channels=1, dtype=np.int16, blocksize=frame_size)
        stream.start()
        
        silence_frames = 0
        max_silence_frames = 20
        while True:
            frame, _ = stream.read(frame_size)
            is_speech = vad.is_speech(frame.tobytes(), fs)
            audio_buffer.append(frame)
            if is_speech:
                silence_frames = 0
            else:
                silence_frames += 1
            if silence_frames > max_silence_frames:
                break
        
        stream.stop()
        stream.close()
        
        audio_data = np.concatenate(audio_buffer, axis=0)
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_wav:
            with wave.open(temp_wav.name, 'wb') as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(fs)
                wf.writeframes(audio_data.tobytes())
            
            try:
                with open(temp_wav.name, "rb") as audio_file:
                    transcript = await self.openai_client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        language="hi"
                    )
                os.unlink(temp_wav.name)
                print(f"User: {transcript.text}")
                return transcript.text
            except Exception as e:
                os.unlink(temp_wav.name)
                raise Exception(f"OpenAI transcription error: {str(e)}")

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
            print('Assistant: ', message)
            return message
        except Exception as e:
            raise Exception(f"OpenAI chat error: {str(e)}")

    async def speak(self, xyz):
        try:
            audio_stream = self.elevenlabs_client.text_to_speech.convert(
                voice_id="JBFqnCBsd6RMkjVDRZzb",
                text=xyz,
                model_id="eleven_multilingual_v2"
            )
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_audio:
                async for chunk in audio_stream:
                    if chunk:
                        temp_audio.write(chunk)
                temp_audio.flush()
                
                # Get audio duration using ffmpeg-python
                probe = ffmpeg.probe(temp_audio.name)
                audio_duration = float(probe['streams'][0]['duration'])
                video_duration = 26 * 0.1  # 26 PNGs * 0.1s per frame
                loops = int(max(1, (audio_duration + 0.1) / video_duration))  # Ensure at least 1 loop
                
                with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp_output:
                    try:
                        stream = (
                            ffmpeg.input(self.looping_video, stream_loop=loops)
                            .input(temp_audio.name)
                            .output(temp_output.name, vcodec="copy", acodec="aac", shortest=None, format="mp4")
                            .run(overwrite_output=True)
                        )
                        os.unlink(temp_audio.name)
                        
                        clip = mp.VideoFileClip(temp_output.name)
                        clip.preview(fps=10)
                        os.unlink(temp_output.name)
                    except ffmpeg.Error as e:
                        os.unlink(temp_audio.name)
                        os.unlink(temp_output.name)
                        raise Exception(f"FFmpeg error in speak: {e.stderr.decode()}")
        except Exception as e:
            raise Exception(f"Speak error: {str(e)}")

async def main():
    assistant = VoiceAssistant()
    while True:
        try:
            start = time.time()
            text = await assistant.listen()
            print(f"Listen: {time.time() - start:.2f}s")
            if "goodbye" in text.strip().lower():
                print("Assistant: Goodbye! Have a great day!")
                start = time.time()
                await assistant.speak("Goodbye! Have a great day!")
                print(f"Speak: {time.time() - start:.2f}s")
                break
            start = time.time()
            response = await assistant.think(text)
            print(f"Think: {time.time() - start:.2f}s")
            start = time.time()
            await assistant.speak(response)
            print(f"Speak: {time.time() - start:.2f}s")
        except Exception as e:
            print(f"Error: {str(e)}")
            break

if __name__ == "__main__":
    asyncio.run(main())