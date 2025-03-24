# VibeCheck Server API Documentation for React Native Developers

## Overview
This documentation provides a comprehensive guide for React Native developers to integrate the VibeCheck client app with its Express.js-based server API. The server uses:
- Clerk for authentication
- SQLite with Drizzle ORM for data management
- WebSockets for real-time updates
- Endpoints for conversations, audio uploads, subscriptions, usage statistics, and user management

## Base URL
All API endpoints are relative to:
```
https://your-server-domain/api/v1
```
Replace `your-server-domain` with the actual domain where the server is hosted.

## Authentication

### Overview
The API uses Clerk for authentication. Most endpoints require a valid JWT token, which must be included in the Authorization header of each request.

### Setup
1. Install the Clerk SDK in your React Native project:
```bash
npm install @clerk/clerk-expo
```

2. Configure Clerk with your publishable key:
```javascript
import { ClerkProvider } from '@clerk/clerk-expo';

export default function App() {
  return (
    <ClerkProvider publishableKey="YOUR_CLERK_PUBLISHABLE_KEY">
      {/* Your app components */}
    </ClerkProvider>
  );
}
```

3. Obtain the JWT token after user sign-in:
```javascript
import { useAuth } from '@clerk/clerk-expo';

const { getToken } = useAuth();

const fetchToken = async () => {
  const token = await getToken();
  return token;
};
```

### Using the Token
Include the token in the Authorization header for all protected requests:
```
Authorization: Bearer <token>
```

Example using fetch:
```javascript
const token = await fetchToken();
const response = await fetch('https://your-server-domain/api/v1/users/me', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});
```

## API Endpoints

### Conversations

#### POST /conversations
Creates a new conversation.

**Authentication:** Required

**Request Body:**
```json
{
  "mode": "string", // e.g., "mediator", "counselor", "dinner", "movie"
  "recordingType": "string" // e.g., "separate", "live"
}
```

**Response (201 Created):**
```json
{
  "conversationId": "string"
}
```

**Example:**
```javascript
const createConversation = async () => {
  const token = await fetchToken();
  const response = await fetch('https://your-server-domain/api/v1/conversations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mode: 'mediator',
      recordingType: 'separate',
    }),
  });
  const data = await response.json();
  return data.conversationId;
};
```

#### GET /conversations/:conversationId
Retrieves details of a specific conversation.

**Authentication:** Required

**Path Parameter:** conversationId (string)

**Response (200 OK):**
```json
{
  "id": "string",
  "mode": "string",
  "recordingType": "string",
  "status": "string", // e.g., "waiting", "processing", "completed", "failed"
  "gptResponse": "string", // Optional, present when status is "completed"
  "errorMessage": "string", // Optional, present when status is "failed"
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

**Example:**
```javascript
const getConversation = async (conversationId) => {
  const token = await fetchToken();
  const response = await fetch(`https://your-server-domain/api/v1/conversations/${conversationId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return await response.json();
};
```

### Audio

#### POST /audio
Uploads an audio file associated with a conversation.

**Authentication:** Required

**Request:** Multipart form data
- audio: Audio file (webm, wav, m4a)
- conversationId: String ID of the conversation

**Response (202 Accepted):**
```json
{
  "message": "Audio uploaded and queued",
  "audioId": "number"
}
```

**Example:**
```javascript
import * as FileSystem from 'expo-file-system';

const uploadAudio = async (audioUri, conversationId) => {
  const token = await fetchToken();
  const formData = new FormData();
  formData.append('audio', {
    uri: audioUri,
    name: 'recording.m4a',
    type: 'audio/m4a',
  });
  formData.append('conversationId', conversationId);

  const response = await fetch('https://your-server-domain/api/v1/audio', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });
  return await response.json();
};
```

### Subscriptions

#### POST /subscriptions/verify
Verifies an in-app purchase receipt from the App Store.

**Authentication:** Required

**Request Body:**
```json
{
  "receiptData": "string" // Base64-encoded receipt data
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "subscription": {
    "isValid": true,
    "type": "string", // e.g., "monthly", "yearly"
    "expiresDate": "timestamp"
  }
}
```

**Example:**
```javascript
import { InAppPurchases } from 'expo-in-app-purchases';

const verifyReceipt = async (receipt) => {
  const token = await fetchToken();
  const response = await fetch('https://your-server-domain/api/v1/subscriptions/verify', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ receiptData: receipt }),
  });
  return await response.json();
};

// Handle purchase
InAppPurchases.connectAsync().then(() => {
  InAppPurchases.setPurchaseListener(async ({ responseCode, results }) => {
    if (responseCode === InAppPurchases.IAPResponseCode.OK) {
      const purchase = results[0];
      const receipt = purchase.receipt;
      await verifyReceipt(receipt);
      await InAppPurchases.finishTransactionAsync(purchase, false);
    }
  });
});
```

#### GET /subscriptions/status
Checks the user's subscription status.

**Authentication:** Required

**Response (200 OK):**
```json
{
  "isSubscribed": true,
  "subscription": {
    "type": "string",
    "expiresDate": "timestamp"
  }
}
```

**Example:**
```javascript
const checkSubscriptionStatus = async () => {
  const token = await fetchToken();
  const response = await fetch('https://your-server-domain/api/v1/subscriptions/status', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return await response.json();
};
```

### Usage

#### GET /usage/stats
Retrieves the user's usage statistics.

**Authentication:** Required

**Response (200 OK):**
```json
{
  "usage": {
    "currentUsage": "number", // Conversations used this month
    "limit": "number", // 10 for free users, -1 for subscribers
    "isSubscribed": "boolean",
    "remainingConversations": "number", // Remaining for free users, -1 for subscribers
    "resetDate": "timestamp" // Next reset date for free users
  }
}
```

**Example:**
```javascript
const getUsageStats = async () => {
  const token = await fetchToken();
  const response = await fetch('https://your-server-domain/api/v1/usage/stats', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return await response.json();
};
```

### Users

#### GET /users/me
Fetches the authenticated user's profile.

**Authentication:** Required

**Response (200 OK):**
```json
{
  "user": {
    "id": "string",
    "email": "string",
    "name": "string",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

**Example:**
```javascript
const getUserProfile = async () => {
  const token = await fetchToken();
  const response = await fetch('https://your-server-domain/api/v1/users/me', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return await response.json();
};
```

## WebSocket Integration

### Connection
URL: `ws://your-server-domain/ws`

Authentication: Append the JWT token as a query parameter:
```
ws://your-server-domain/ws?token=<JWT_TOKEN>
```

**Example:**
```javascript
import WebSocket from 'react-native-websocket';

const WebSocketComponent = () => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const connectWebSocket = async () => {
      const token = await fetchToken();
      const ws = new WebSocket(`ws://your-server-domain/ws?token=${token}`);
      setSocket(ws);
    };
    connectWebSocket();
  }, []);

  return (
    <WebSocket
      ref={ref => setSocket(ref)}
      onOpen={() => console.log('WebSocket Connected')}
      onMessage={handleMessage}
      onClose={() => console.log('WebSocket Closed')}
      onError={error => console.error('WebSocket Error:', error)}
    />
  );
};
```

### Subscribing to Updates
Subscribe to a specific conversation's updates:
```javascript
socket.send(JSON.stringify({
  type: 'subscribe',
  topic: `conversation:${conversationId}`,
}));
```

### Message Types

#### connected
Sent upon successful connection.

**Payload:**
```json
{
  "message": "Connected to VibeCheck WebSocket server",
  "userId": "string"
}
```

#### conversation_started
Sent when a conversation is created.

**Payload:**
```json
{
  "conversationId": "string",
  "timestamp": "string",
  "mode": "string"
}
```

#### conversation_progress
Sent during processing updates.

**Payload:**
```json
{
  "conversationId": "string",
  "timestamp": "string",
  "progress": "number",
  "stage": "string"
}
```

#### conversation_completed
Sent when processing is complete.

**Payload:**
```json
{
  "conversationId": "string",
  "timestamp": "string",
  "resultUrl": "string"
}
```

#### conversation_error
Sent on processing errors.

**Payload:**
```json
{
  "conversationId": "string",
  "timestamp": "string",
  "error": "string",
  "code": "string"
}
```

#### subscription_updated
Sent when subscription status changes.

**Payload:**
```json
{
  "timestamp": "string",
  "status": "string",
  "plan": "string",
  "expiresAt": "string"
}
```

#### usage_updated
Sent when usage metrics change.

**Payload:**
```json
{
  "timestamp": "string",
  "remainingConversations": "number",
  "totalConversations": "number",
  "resetDate": "string"
}
```

#### user_updated
Sent when user profile updates.

**Payload:**
```json
{
  "timestamp": "string",
  "profile": {
    "name": "string",
    "email": "string"
  }
}
```

**Example Handler:**
```javascript
const handleMessage = (event) => {
  const message = JSON.parse(event.data);
  switch (message.type) {
    case 'conversation_progress':
      console.log(`Progress: ${message.payload.progress}% - ${message.payload.stage}`);
      break;
    case 'conversation_completed':
      console.log(`Completed: ${message.payload.resultUrl}`);
      break;
    case 'conversation_error':
      console.error(`Error: ${message.payload.error}`);
      break;
    default:
      console.log('Received:', message);
  }
};
```

## Error Handling

### Status Codes
The API uses standard HTTP status codes:
- 200 OK: Success
- 201 Created: Resource created
- 400 Bad Request: Invalid request
- 401 Unauthorized: Invalid or missing token
- 404 Not Found: Resource not found
- 429 Too Many Requests: Rate limit exceeded
- 500 Internal Server Error: Server error

Error responses include:
```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

**Example:**
```javascript
const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`${response.status}: ${error.error}`);
  }
  return response.json();
};
```

## Rate Limiting

### Limits
- General: 60 requests/minute
- Authentication: 30 requests/15 minutes
- Uploads: 20 uploads/hour
- Conversations: 10 creations/30 minutes (free users)

If exceeded, a 429 response is returned with a Retry-After header.

**Example Implementation:**
```javascript
const fetchWithRetry = async (url, options, retries = 3) => {
  try {
    const response = await fetch(url, options);
    if (response.status === 429 && retries > 0) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return fetchWithRetry(url, options, retries - 1);
    }
    return handleResponse(response);
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
};
```

### WebSocket Reconnection
Handle WebSocket disconnections with exponential backoff:

```javascript
const connectWithRetry = async (token, maxRetries = 5) => {
  let retries = 0;

  const connect = () => {
    const ws = new WebSocket(`ws://your-server-domain/ws?token=${token}`);

    ws.onclose = (event) => {
      if (retries < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retries), 30000);
        setTimeout(() => {
          retries++;
          connect();
        }, delay);
      } else {
        console.error('Max retries reached');
      }
    };

    return ws;
  };

  return connect();
};
```

## Best Practices
1. **Authentication**: Always include the token for protected endpoints
2. **Error Handling**: Handle all HTTP status codes and WebSocket errors gracefully
3. **Rate Limiting**: Respect Retry-After headers and implement backoff
4. **WebSocket**: Subscribe only to necessary topics and manage connections
5. **File Uploads**: Ensure audio files are in supported formats (webm, wav, m4a)

This documentation should enable you to effectively integrate the VibeCheck server API into your React Native app. For further assistance, refer to the server logs or contact the backend team.