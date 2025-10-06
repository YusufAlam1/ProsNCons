# Pros and Cons Backend API

This is a FastAPI backend that provides sentiment analysis for the Pros and Cons application using TextBlob.

## Features

- **Sentiment Analysis**: Uses TextBlob to analyze the sentiment of pros and cons
- **Automatic Weighting**: Assigns weights (1-10) based on sentiment analysis:
  - For **pros**: More positive sentiment = higher weight
  - For **cons**: More negative sentiment = higher weight (more concerning)
- **CORS Support**: Configured to work with React frontend on localhost:3000

## API Endpoints

### `POST /analyze-sentiment`
Analyzes sentiment and returns an appropriate weight.

**Request Body:**
```json
{
  "text": "This is a great opportunity for growth",
  "item_type": "pro"
}
```

**Response:**
```json
{
  "weight": 8.5,
  "sentiment_score": 0.7,
  "confidence": 0.85,
  "explanation": "Positive sentiment detected in pro item. Higher positivity increases weight."
}
```

### `GET /health`
Health check endpoint.

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the server:
```bash
python main.py
```

Or use the provided batch file:
```bash
start_server.bat
```

The server will start on `http://localhost:8000`

## Sentiment Analysis Logic

### For Pros:
- Positive sentiment (0 to 1): Weight scales from 5 to 10
- Negative sentiment (-1 to 0): Weight scales from 1 to 5
- Neutral sentiment (0): Weight = 5

### For Cons:
- Negative sentiment (-1 to 0): Weight scales from 5 to 10 (more concerning)
- Positive sentiment (0 to 1): Weight scales from 1 to 5 (less concerning)
- Neutral sentiment (0): Weight = 5

## Dependencies

- **FastAPI**: Web framework
- **TextBlob**: Natural language processing and sentiment analysis
- **Uvicorn**: ASGI server
- **Pydantic**: Data validation