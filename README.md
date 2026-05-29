# 🗣️ AI Avatar Chatbot

A chatbot with a 3D animated avatar that lip-syncs to the AI's responses with facial expressions.

![Demo](demo.gif)

## Features

- 💬 Chat with an AI assistant (powered by MiMo LLM)
- 🎭 3D avatar with viseme-based lip sync
- 😊 Facial expressions based on sentiment (happy, sad, thinking)
- 👀 Natural blinking and head movement
- 🎤 Text-to-speech audio generation
- 🌙 Dark theme UI

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React + Vite + Three.js |
| 3D Avatar | @react-three/fiber + procedural geometry |
| Lip Sync | Viseme morph targets |
| TTS | Edge TTS (Microsoft) |
| LLM | Xiaomi MiMo |
| Backend | Python FastAPI |

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.9+
- Xiaomi API Key (for LLM)

### Backend Setup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your XIAOMI_API_KEY

# Start server
chmod +x start.sh
./start.sh
```

Backend runs at `http://localhost:8000`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs at `http://localhost:5173`

### Environment Variables

**Backend (.env):**
```env
XIAOMI_API_KEY=your_key_here
LLM_BASE_URL=https://token-plan-sgp.xiaomimimo.com/v1
LLM_MODEL=mimo-v2.5-pro
```

**Frontend (.env):**
```env
VITE_API_URL=http://localhost:8000
```

## How It Works

1. User types a message in the chat panel
2. Backend sends message to LLM (MiMo)
3. LLM generates a text response
4. Backend converts text to speech (Edge TTS)
5. Backend generates viseme sequence from text
6. Frontend plays audio and animates avatar's mouth
7. Avatar shows expressions based on response sentiment

## Viseme System

The avatar uses 13 viseme morph targets:

| Viseme | Sound | Example |
|--------|-------|---------|
| viseme_aa | "ah" | f**a**ther |
| viseme_E | "eh" | b**e**d |
| viseme_I | "ee" | b**ee**t |
| viseme_O | "oh" | g**o** |
| viseme_U | "oo" | b**oo**t |
| viseme_PP | "b/p/m" | **p**at |
| viseme_FF | "f/v" | **f**at |
| viseme_TH | "th" | **th**in |
| viseme_DD | "d/t" | **d**ig |
| viseme_SS | "s/z" | **s**at |
| viseme_nn | "n/l" | **l**ip |
| viseme_kk | "k/g" | **k**it |
| viseme_RR | "r" | **r**at |

## Deployment

### GitHub Pages (Frontend)

```bash
cd frontend
npm run build
# Deploy dist/ to GitHub Pages
```

### Azure VM (Backend)

```bash
# SSH into your VM
ssh azureuser@your-vm-ip

# Clone repo
git clone <repo-url>
cd talking-avatar-chatbot/backend

# Setup and run
pip install -r requirements.txt
cp .env.example .env
# Edit .env
nohup python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 &
```

## License

MIT

## Credits

- [Three.js](https://threejs.org/) - 3D graphics
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/) - React renderer for Three.js
- [Edge TTS](https://github.com/rany2/edge-tts) - Free text-to-speech
- [Xiaomi MiMo](https://mimo.xiaomi.com/) - LLM
