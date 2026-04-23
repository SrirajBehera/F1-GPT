import { DataAPIClient } from "@datastax/astra-db-ts";
import { GoogleGenAI } from "@google/genai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, convertToModelMessages, UIMessage } from "ai";

import "dotenv/config";

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  GEMINI_API_KEY,
} = process.env;

// For embeddings
const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// For chat — uses your existing GEMINI_API_KEY
const google = createGoogleGenerativeAI({ apiKey: GEMINI_API_KEY });

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT, {
  keyspace: ASTRA_DB_NAMESPACE,
});

// Extract plain text from a UIMessage (parts-based format)
function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { type: "text"; text: string }).text)
    .join("");
}

export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();
    const latestMessage = messages[messages.length - 1];
    const latestMessageText = getMessageText(latestMessage);

    let docContext = "";

    const embedding = await genai.models.embedContent({
      model: "gemini-embedding-001",
      contents: [latestMessageText],
      config: { outputDimensionality: 768 },
    });

    try {
      const collection = db.collection(ASTRA_DB_COLLECTION);
      const cursor = collection.find(null, {
        sort: {
          $vector: embedding.embeddings[0].values,
        },
        limit: 10,
      });

      const documents = await cursor.toArray();

      const docsMap = documents.map((doc) => doc.text);

      docContext = JSON.stringify(docsMap);
    } catch (error) {
      console.log("Error querying DB", error);
      docContext = "";
    }

    const systemPrompt = `
      You are an AI assistant who knows everything about Formula 1. Use the below context to augment what you know about Formula 1 Racing. The context will provide you with the most recent page data from wikipedia, the official F1 website and others. If the context doesn't include the information you need answer based on your existing knowledge and don't mention the source of your information or what the does or doesn't include. Format responses using markdown wherever applicable and don't return images.

      --------------
      START CONTEXT
      ${docContext}
      END CONTEXT
      --------------
      QUESTION: ${latestMessage}
      --------------
    `;

    const result = streamText({
      model: google("gemini-3.1-flash-lite-preview"),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    console.log("Error", err);
  }
}
