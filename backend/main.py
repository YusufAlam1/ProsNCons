from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from textblob import TextBlob
import uvicorn

app = FastAPI(title="Pros and Cons Sentiment Analysis API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TextInput(BaseModel):
    text: str
    item_type: str  # "pro" or "con"

class WeightResponse(BaseModel):
    weight: float
    sentiment_score: float
    confidence: float
    explanation: str

def analyze_sentiment(text: str, item_type: str) -> WeightResponse:
    """
    Analyze sentiment of text and return appropriate weight.
    
    For pros: Higher positive sentiment = higher weight
    For cons: Higher negative sentiment = higher weight (more concerning)
    """
    blob = TextBlob(text)
    
    # Get polarity (-1 to 1) and subjectivity (0 to 1)
    polarity = blob.sentiment.polarity
    subjectivity = blob.sentiment.subjectivity
    
    # Calculate confidence based on subjectivity (more objective = more confident)
    confidence = 1 - subjectivity
    
    if item_type.lower() == "pro":
        # For pros: positive sentiment should get higher weight
        # Scale from 1-10, with neutral being 5
        if polarity > 0:
            # Positive sentiment: scale from 5 to 10
            weight = 5 + (polarity * 5)
        elif polarity < 0:
            # Negative sentiment: scale from 1 to 5
            weight = 5 + (polarity * 4)  # polarity is negative, so this subtracts
        else:
            # Neutral sentiment
            weight = 5
            
        explanation = f"Positive sentiment detected in pro item. Higher positivity increases weight."
        
    else:  # con
        # For cons: negative sentiment should get higher weight (more concerning)
        # Scale from 1-10, with neutral being 5
        if polarity < 0:
            # Negative sentiment: scale from 5 to 10 (more concerning = higher weight)
            weight = 5 + (abs(polarity) * 5)
        elif polarity > 0:
            # Positive sentiment: scale from 1 to 5 (less concerning = lower weight)
            weight = 5 - (polarity * 4)
        else:
            # Neutral sentiment
            weight = 5
            
        explanation = f"Negative sentiment detected in con item. Higher negativity increases weight (more concerning)."
    
    # Ensure weight is within bounds and round to 1 decimal place
    weight = max(1, min(10, round(weight, 1)))
    
    return WeightResponse(
        weight=weight,
        sentiment_score=polarity,
        confidence=round(confidence, 2),
        explanation=explanation
    )

@app.get("/")
async def root():
    return {"message": "Pros and Cons Sentiment Analysis API is running!"}

@app.post("/analyze-sentiment", response_model=WeightResponse)
async def analyze_text_sentiment(input_data: TextInput):
    """
    Analyze the sentiment of a pro or con item and return an appropriate weight.
    """
    try:
        if not input_data.text.strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        if input_data.item_type.lower() not in ["pro", "con"]:
            raise HTTPException(status_code=400, detail="item_type must be 'pro' or 'con'")
        
        result = analyze_sentiment(input_data.text, input_data.item_type)
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing sentiment: {str(e)}")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "sentiment-analysis"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)