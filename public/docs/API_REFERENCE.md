# API Reference

## Base URL
```
Production: https://api.promptd.com
Development: http://localhost:3000
```

## Authentication
ทุก request ต้องมี header:
```
Authorization: Bearer {token}
```

## Endpoints

### 1. User Authentication

#### Login
```http
POST /api/login
Content-Type: application/json

{
  "username": "string",
  "password": "string"
}

Response:
{
  "token": "jwt_token_string",
  "user": {
    "id": "user_xxxxx",
    "username": "string"
  }
}
```

### 2. Character Management

#### Get All Characters
```http
GET /api/characters/{userId}

Response:
[
  {
    "id": "char_xxxxx",
    "name": "string",
    "profile": "string (17 items format)",
    "preview": "string",
    "timestamp": 1234567890
  }
]
```

#### Save Character
```http
POST /api/characters/{userId}
Content-Type: application/json

{
  "name": "string",
  "profile": "string",
  "preview": "string"
}

Response:
{
  "success": true,
  "character": {...}
}
```

#### Update Character
```http
PUT /api/characters/{userId}/{characterId}
Content-Type: application/json

{
  "name": "string",
  "profile": "string",
  "preview": "string"
}
```

#### Delete Character
```http
DELETE /api/characters/{userId}/{characterId}

Response:
{
  "success": true
}
```

### 3. Chat & Prompt Generation

#### Send Message
```http
POST /api/chat
Content-Type: application/json

{
  "userId": "string",
  "mode": "general|character|promptmaster|multichar|image|chat",
  "message": "string",
  "context": "string (optional)"
}

Response:
{
  "response": "AI generated response",
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 200,
    "total_tokens": 300
  }
}
```

### 4. Credits System

#### Get Credits
```http
GET /api/credits/{userId}

Response:
{
  "currentCredits": 150.50,
  "history": [
    {
      "timestamp": 1234567890,
      "amount": -10.5,
      "description": "Chat usage",
      "balance": 150.50
    }
  ]
}
```

#### Purchase Credits (Admin Only)
```http
POST /api/admin/credits/purchase
Content-Type: application/json

{
  "userId": "string",
  "amount": 100,
  "description": "Purchase via admin"
}
```

### 5. Favorites

#### Get Favorites
```http
GET /api/favorites/{userId}

Response:
[
  {
    "id": "fav_xxxxx",
    "prompt": "string",
    "response": "string",
    "mode": "string",
    "timestamp": 1234567890
  }
]
```

#### Add Favorite
```http
POST /api/favorites/{userId}
Content-Type: application/json

{
  "prompt": "string",
  "response": "string",
  "mode": "string"
}
```

#### Remove Favorite
```http
DELETE /api/favorites/{userId}/{favoriteId}
```

## Error Responses

### Standard Error Format
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message"
  }
}
```

### Common Error Codes
- `AUTH_FAILED` - Authentication failed
- `TOKEN_EXPIRED` - JWT token expired
- `INSUFFICIENT_CREDITS` - Not enough credits
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Input validation failed
- `SERVER_ERROR` - Internal server error

## Rate Limiting
- 100 requests per minute per user
- 1000 requests per hour per user
- Headers แสดง rate limit status:
  ```
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 95
  X-RateLimit-Reset: 1234567890
  ```

## WebSocket Events (Future)
```javascript
// Connection
ws.connect('wss://api.promptd.com/ws?token={token}');

// Events
ws.on('credit_update', (data) => {
  console.log('New balance:', data.balance);
});

ws.on('character_sync', (data) => {
  console.log('Character updated:', data.character);
});
```