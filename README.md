# 🎬 Veo 3 Prompt Generator

AI-powered tool for generating cinematic prompts for Google's Veo 3 video generation model with rate limiting (5 THB/user/day).

![Veo 3 Prompt Generator](https://img.shields.io/badge/Veo%203-Prompt%20Generator-purple)
![Rate Limited](https://img.shields.io/badge/Rate%20Limit-5%20THB%2Fday-green)

## ✨ Features

- 🎬 Generate cinematic prompts for Veo 3
- 📷 Support for image references
- 💰 Rate limiting (5 THB per user per day)
- 📊 Real-time usage tracking
- 🌙 Beautiful dark mode UI
- 🚀 Deployed on Railway

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **AI**: OpenAI GPT-4o-mini
- **Database**: PostgreSQL
- **Deployment**: Railway
- **Frontend**: Vanilla JS with modern CSS

## 📦 Installation

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/veo3-prompt-generator.git
cd veo3-prompt-generator
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
Create a `.env` file:
```env
OPENAI_API_KEY=your-openai-api-key
DATABASE_URL=postgresql://user:password@host:port/database
NODE_ENV=production
```

### 4. Set up database
```bash
npm run setup-db
```

### 5. Start the server
```bash
npm start
```

## 🚀 Deployment on Railway

### 1. Push to GitHub
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Deploy on Railway
1. Go to [Railway.app](https://railway.app)
2. Create new project → Deploy from GitHub repo
3. Add PostgreSQL database
4. Set environment variables:
   - `OPENAI_API_KEY`
   - `DATABASE_URL` (auto-filled by Railway)

### 3. Run database setup
In Railway dashboard:
```bash
railway run npm run setup-db
```

## 📖 Usage

1. **Basic Prompt**: Type your video idea
2. **With Images**: Upload reference images for style
3. **Copy Result**: Click copy button to use in Veo 3

### Example Prompts

**Cinematic Scene**:
> "Aerial tracking shot of neon-lit Tokyo at night, rain-slicked streets reflecting vibrant signs, cyberpunk atmosphere, slow dolly movement"

**Nature Documentary**:
> "Golden hour time-lapse of African savanna, acacia trees silhouetted against orange sky, elephants crossing in distance"

## 💰 Rate Limiting

- **Daily Limit**: 5 THB per user
- **Cost Calculation**: ~0.02 THB per 1K tokens
- **Average Request**: ~0.05-0.10 THB
- **Daily Requests**: ~50-100 prompts

## 📁 Project Structure

```
veo3-prompt-generator/
├── public/
│   ├── index.html      # Main UI
│   ├── script.js       # Frontend logic
│   └── style.css       # Styles (embedded)
├── server.js           # Express server
├── database.js         # Database functions
├── setup-database.js   # DB setup script
├── package.json        # Dependencies
├── .env               # Environment vars
└── README.md          # This file
```

## 🔧 API Endpoints

### Generate Prompt
```http
POST /api/chat
Content-Type: application/json

{
  "message": "sunset over mountains",
  "userId": "user_123",
  "images": []
}
```

### Get Usage
```http
GET /api/usage/:userId
```

## 🐛 Troubleshooting

### "Rate limit exceeded"
- Wait until next day (resets at midnight)
- Check usage with `/api/usage/:userId`

### "Database connection failed"
- Check DATABASE_URL in environment variables
- Ensure PostgreSQL is running
- Run `npm run setup-db` again

### "API key invalid"
- Verify OPENAI_API_KEY is correct
- Check OpenAI account credits

## 📄 License

MIT License - feel free to use for your projects!

## 🙏 Credits

Built with ❤️ for creative video makers using Veo 3

---

**Need help?** Open an issue or contact support.