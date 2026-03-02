import os
import magic
from io import BytesIO

def parse_document(file_path: str, original_filename: str) -> str:
    """Detects file type and extracts text content from various file formats."""
    if not os.path.exists(file_path):
        return ""

    mime_type = magic.from_file(file_path, mime=True)
    ext = os.path.splitext(original_filename)[1].lower()

    if "pdf" in mime_type or ext == ".pdf":
        return _parse_pdf(file_path)
    elif "wordprocessingml" in mime_type or ext == ".docx":
        return _parse_docx(file_path)
    elif "spreadsheetml" in mime_type or ext in [".xlsx", ".xls"]:
        return _parse_xlsx(file_path)
    elif "csv" in mime_type or ext == ".csv":
        return _parse_csv(file_path)
    elif mime_type.startswith("image/") or ext in [".jpeg", ".jpg", ".png"]:
        return _parse_image(file_path)
    elif mime_type.startswith("audio/") or ext in [".mp3", ".wav"]:
        return _parse_audio(file_path)
    elif mime_type.startswith("video/") or ext in [".mp4", ".mov"]:
        return _parse_video(file_path)
    else:
        # Fallback to plain text
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            return f"Unsupported or unparseable file format: {mime_type} ({ext})"

def _parse_pdf(file_path: str) -> str:
    import PyPDF2
    text = ""
    try:
        with open(file_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                text += page.extract_text() + "\n"
    except Exception as e:
        text = f"Error parsing PDF: {e}"
    return text

def _parse_docx(file_path: str) -> str:
    import docx
    text = ""
    try:
        doc = docx.Document(file_path)
        for para in doc.paragraphs:
            text += para.text + "\n"
    except Exception as e:
        text = f"Error parsing DOCX: {e}"
    return text

def _parse_xlsx(file_path: str) -> str:
    import pandas as pd
    try:
        df = pd.read_excel(file_path)
        return df.to_string()
    except Exception as e:
        return f"Error parsing XLSX: {e}"

def _parse_csv(file_path: str) -> str:
    import pandas as pd
    try:
        df = pd.read_csv(file_path)
        return df.to_string()
    except Exception as e:
        return f"Error parsing CSV: {e}"

def _parse_image(file_path: str) -> str:
    from PIL import Image
    import pytesseract
    try:
        img = Image.open(file_path)
        text = pytesseract.image_to_string(img)
        return text
    except Exception as e:
        return f"Error parsing Image OCR: {e}"

def _parse_audio(file_path: str) -> str:
    import speech_recognition as sr
    from pydub import AudioSegment
    import tempfile
    
    try:
        # Convert audio to wav format for speech recognition
        audio = AudioSegment.from_file(file_path)
        
        with tempfile.NamedTemporaryFile(suffix=".wav") as tmp_wav:
            audio.export(tmp_wav.name, format="wav")
            
            recognizer = sr.Recognizer()
            with sr.AudioFile(tmp_wav.name) as source:
                audio_data = recognizer.record(source)
                try:
                    text = recognizer.recognize_google(audio_data)
                    return text
                except sr.UnknownValueError:
                    return "Speech recognition could not understand the audio"
                except sr.RequestError as e:
                    return f"Could not request results from Speech Recognition service; {e}"
    except Exception as e:
        return f"Error processing audio: {e}"

def _parse_video(file_path: str) -> str:
    from moviepy import VideoFileClip
    import tempfile
    import os
    
    try:
        video = VideoFileClip(file_path)
        if video.audio is None:
            return "Video contains no audio track."
            
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_audio:
            tmp_audio_name = tmp_audio.name
            
        try:
            video.audio.write_audiofile(tmp_audio_name, verbose=False, logger=None)
            # Now parse the extracted audio
            return _parse_audio(tmp_audio_name)
        finally:
            if os.path.exists(tmp_audio_name):
                os.remove(tmp_audio_name)
    except Exception as e:
        return f"Error parsing video audio: {e}"
