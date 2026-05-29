import asyncio
import base64
import json
import os
import re
import tempfile
from pathlib import Path

import edge_tts
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# LLM Config
XIAOMI_API_KEY = os.getenv("XIAOMI_API_KEY", "")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://token-plan-sgp.xiaomimimo.com/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "mimo-v2.5-pro")

client = OpenAI(api_key=XIAOMI_API_KEY, base_url=LLM_BASE_URL)

# Viseme mapping - maps phoneme groups to viseme blend shapes
VISEME_MAP = {
    "AA": "viseme_aa",  # "ah" - father
    "AE": "viseme_aa",  # "a" - cat
    "AH": "viseme_aa",  # "uh" - but
    "AO": "viseme_O",   # "aw" - thought
    "AW": "viseme_aa",  # "ow" - cow
    "AY": "viseme_aa",  # "eye"
    "B":  "viseme_PP",  # "b" - big
    "CH": "viseme_SS",  # "ch" - chin
    "D":  "viseme_DD",  # "d" - dig
    "DH": "viseme_TH",  # "th" - this
    "EH": "viseme_E",   # "e" - bed
    "ER": "viseme_RR",  # "er" - bird
    "EY": "viseme_E",   # "ay" - say
    "F":  "viseme_FF",  # "f" - fat
    "G":  "viseme_kk",  # "g" - gut
    "HH": "viseme_sil", # "h" - hat
    "IH": "viseme_I",   # "i" - bit
    "IY": "viseme_I",   # "ee" - beet
    "JH": "viseme_SS",  # "j" - just
    "K":  "viseme_kk",  # "k" - kit
    "L":  "viseme_nn",  # "l" - lip
    "M":  "viseme_PP",  # "m" - map
    "N":  "viseme_nn",  # "n" - net
    "NG": "viseme_nn",  # "ng" - sing
    "OW": "viseme_O",   # "o" - go
    "OY": "viseme_O",   # "oy" - boy
    "P":  "viseme_PP",  # "p" - pat
    "R":  "viseme_RR",  # "r" - rat
    "S":  "viseme_SS",  # "s" - sat
    "SH": "viseme_SS",  # "sh" - she
    "T":  "viseme_DD",  # "t" - tap
    "TH": "viseme_TH",  # "th" - thin
    "UH": "viseme_U",   # "oo" - book
    "UW": "viseme_U",   # "oo" - boot
    "V":  "viseme_FF",  # "v" - van
    "W":  "viseme_U",   # "w" - wet
    "Y":  "viseme_I",   # "y" - yes
    "Z":  "viseme_SS",  # "z" - zip
    "ZH": "viseme_SS",  # "zh" - measure
}


def text_to_visemes(text: str) -> list:
    """Convert text to a sequence of viseme keyframes with timing."""
    words = text.split()
    visemes = []
    current_time = 0.0
    
    for word in words:
        # Simple phoneme estimation per character
        chars = word.lower()
        char_duration = 0.08  # ~80ms per character sound
        
        for i, char in enumerate(chars):
            if char in 'aeiou':
                viseme_name = VISEME_MAP.get("AA", "viseme_aa")
                if char in 'ei':
                    viseme_name = VISEME_MAP.get("IY", "viseme_I")
                elif char in 'ou':
                    viseme_name = VISEME_MAP.get("OW", "viseme_O")
                elif char == 'u':
                    viseme_name = VISEME_MAP.get("UW", "viseme_U")
            elif char in 'pbm':
                viseme_name = VISEME_MAP.get("B", "viseme_PP")
            elif char in 'fv':
                viseme_name = VISEME_MAP.get("F", "viseme_FF")
            elif char in 'tdn':
                viseme_name = VISEME_MAP.get("D", "viseme_DD")
            elif char in 'sz':
                viseme_name = VISEME_MAP.get("S", "viseme_SS")
            elif char in 'rl':
                viseme_name = VISEME_MAP.get("R", "viseme_RR")
            elif char in 'kg':
                viseme_name = VISEME_MAP.get("K", "viseme_kk")
            elif char in 'w':
                viseme_name = VISEME_MAP.get("W", "viseme_U")
            elif char in 'yj':
                viseme_name = VISEME_MAP.get("Y", "viseme_I")
            elif char in 'h':
                viseme_name = "viseme_sil"
            else:
                viseme_name = "viseme_sil"
            
            visemes.append({
                "time": round(current_time, 3),
                "viseme": viseme_name,
                "weight": 0.8 if viseme_name != "viseme_sil" else 0.0
            })
            current_time += char_duration
        
        # Small pause between words
        visemes.append({
            "time": round(current_time, 3),
            "viseme": "viseme_sil",
            "weight": 0.0
        })
        current_time += 0.05
    
    return visemes


def detect_sentiment(text: str) -> str:
    """Simple sentiment detection for facial expressions."""
    text_lower = text.lower()
    positive_words = ["happy", "great", "awesome", "love", "wonderful", "excellent", "good", "nice", "amazing", "fantastic", "😊", "😄", "❤️"]
    negative_words = ["sad", "sorry", "bad", "terrible", "awful", "horrible", "unfortunately", "sadly", "😢", "😞"]
    thinking_words = ["hmm", "let me think", "interesting", "perhaps", "maybe", "consider", "wonder"]
    
    pos_count = sum(1 for w in positive_words if w in text_lower)
    neg_count = sum(1 for w in negative_words if w in text_lower)
    think_count = sum(1 for w in thinking_words if w in text_lower)
    
    if pos_count > neg_count and pos_count > think_count:
        return "happy"
    elif neg_count > pos_count:
        return "sad"
    elif think_count > 0:
        return "thinking"
    return "neutral"


async def generate_tts(text: str) -> tuple:
    """Generate TTS audio using edge-tts. Returns (audio_base64, duration)."""
    communicate = edge_tts.Communicate(text, "en-US-AriaNeural")
    
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
        temp_path = f.name
    
    await communicate.save(temp_path)
    
    with open(temp_path, "rb") as f:
        audio_data = f.read()
    
    audio_b64 = base64.b64encode(audio_data).decode()
    
    # Estimate duration (~150 words per minute average)
    word_count = len(text.split())
    duration = word_count / 2.5  # rough estimate in seconds
    
    os.unlink(temp_path)
    return audio_b64, duration


@app.post("/chat")
async def chat(request: Request):
    data = await request.json()
    user_message = data.get("message", "")
    
    if not user_message:
        return JSONResponse({"error": "No message provided"}, status_code=400)
    
    # Get LLM response
    try:
        response = client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": "You are a friendly, expressive AI assistant. Keep responses concise (2-3 sentences max) and natural. Use a warm, conversational tone."},
                {"role": "user", "content": user_message}
            ],
            max_tokens=200,
            temperature=0.7,
        )
        bot_response = response.choices[0].message.content
    except Exception as e:
        return JSONResponse({"error": f"LLM error: {str(e)}"}, status_code=500)
    
    # Generate TTS audio
    try:
        audio_b64, duration = await generate_tts(bot_response)
    except Exception as e:
        return JSONResponse({"error": f"TTS error: {str(e)}"}, status_code=500)
    
    # Generate visemes
    visemes = text_to_visemes(bot_response)
    
    # Detect sentiment for expression
    sentiment = detect_sentiment(bot_response)
    
    return JSONResponse({
        "response": bot_response,
        "audio": audio_b64,
        "visemes": visemes,
        "sentiment": sentiment,
        "duration": round(duration, 2)
    })


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
