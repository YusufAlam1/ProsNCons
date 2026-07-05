const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: ["http://localhost:3000"], // React dev server
    credentials: true,
  })
);
app.use(express.json());

// Validation helper
const isValidWeight = (weight) => {
  const num = parseInt(weight);
  return !isNaN(num) && num >= 1 && num <= 10;
};

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    message: "ProsNCons OpenAI Weighting API is running!",
    status: "healthy",
    endpoints: ["/api/weight"],
  });
});

// Main weighting endpoint
app.post("/api/weight", async (req, res) => {
  try {
    const { decision, reason, isPro } = req.body;

    // Validation
    if (!decision || !reason) {
      return res.status(400).json({
        error: "Missing required fields: decision and reason are required",
      });
    }

    if (typeof isPro !== "boolean") {
      return res.status(400).json({
        error: "isPro must be a boolean value",
      });
    }

    // Check if OpenAI API key is configured
    if (
      !process.env.OPENAI_API_KEY ||
      process.env.OPENAI_API_KEY === "your_openai_api_key_here"
    ) {
      console.warn("OpenAI API key not configured, returning fallback weight");
      return res.json({
        weight: 5,
        fallback: true,
        message: "OpenAI API key not configured, using fallback weight",
      });
    }

    // Create the prompt for OpenAI
    const prompt = `
I am making a decision about: ${decision.trim()}.
I have listed the following reason: "${reason.trim()}".
This is a ${isPro ? "pro" : "con"}.

On a scale from 1 to 10, how strongly should this point be weighted in the decision-making process?
- 1 = Very weak/minimal impact
- 5 = Moderate impact
- 10 = Very strong/major impact

Consider the significance, potential consequences, and relevance of this point.
Return only a single number between 1 and 10.`.trim();

    // Call OpenAI API
    const openaiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: 10,
          temperature: 0.3,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
        }),
      }
    );

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      console.error("OpenAI API Error:", errorData);

      // Return fallback weight if API fails
      return res.json({
        weight: 5,
        fallback: true,
        message: "OpenAI API error, using fallback weight",
        error: errorData.error?.message || "Unknown API error",
      });
    }

    const data = await openaiResponse.json();
    const weightText = data.choices[0].message.content.trim();

    // Extract number from response
    const weightMatch = weightText.match(/\b([1-9]|10)\b/);
    let weight = weightMatch ? parseInt(weightMatch[1]) : null;

    // Validate the weight
    if (!isValidWeight(weight)) {
      console.warn(
        `Invalid weight received from OpenAI: "${weightText}", using fallback`
      );
      weight = 5; // Fallback
    }

    res.json({
      weight,
      rawResponse: weightText,
      fallback: false,
    });
  } catch (error) {
    console.error("Server error:", error);

    // Return fallback weight on any error
    res.status(500).json({
      weight: 5,
      fallback: true,
      message: "Server error, using fallback weight",
      error: error.message,
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Unhandled error:", error);
  res.status(500).json({
    error: "Internal server error",
    weight: 5,
    fallback: true,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    availableEndpoints: ["/", "/api/weight"],
  });
});

app.listen(PORT, () => {
  console.log(`🚀 ProsNCons backend running on http://localhost:${PORT}`);
  console.log(`📝 Available endpoints:`);
  console.log(`   GET  / - Health check`);
  console.log(`   POST /api/weight - Get AI weight for pros/cons`);

  if (
    !process.env.OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY === "your_openai_api_key_here"
  ) {
    console.log(`⚠️  OpenAI API key not configured - using fallback weights`);
    console.log(`   Set OPENAI_API_KEY in backend/.env file`);
  } else {
    console.log(`✅ OpenAI API key configured`);
  }
});
