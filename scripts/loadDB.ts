import { DataAPIClient } from "@datastax/astra-db-ts";
import { GoogleGenAI } from "@google/genai";
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import "dotenv/config";

type SimilarityMetric = "cosine" | "euclidean" | "dot_product";

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  GEMINI_API_KEY,
} = process.env;

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});

const f1Data = [
  "https://en.wikipedia.org/wiki/Formula_One",
  "https://www.skysports.com/f1/news/12433/13057866/lewis-hamilton-to-join-ferrari-from-mercedes-in-2025-f1-season-switch",
  "https://en.wikipedia.org/wiki/2025_Formula_One_World_Championship",
  "https://en.wikipedia.org/wiki/2026_Formula_One_World_Championship",
  "https://en.wikipedia.org/wiki/List_of_female_Formula_One_drivers",
];

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT, {
  keyspace: ASTRA_DB_NAMESPACE,
});

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512,
  chunkOverlap: 100,
});

const createCollection = async (
  similarity_metric: SimilarityMetric = "dot_product"
) => {
  const response = await db.createCollection(ASTRA_DB_COLLECTION, {
    vector: {
      dimension: 768,
      metric: similarity_metric,
    },
  });

  console.log("Collection created:", response);
};

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

const loadSampleData = async () => {
  const collection = db.collection(ASTRA_DB_COLLECTION);

  for await (const url of f1Data) {
    const content = await scrapePage(url);
    const chunks = await splitter.splitText(content);

    console.log("Got chunks", chunks.length);
    let i = 0;
    for await (const chunk of chunks) {
      const embedding = await ai.models.embedContent({
        model: "gemini-embedding-001",
        contents: chunk,
        config: { outputDimensionality: 768 },
      });

      const vector = embedding.embeddings[0].values;

      const response = await collection.insertOne({
        $vector: vector,
        text: chunk,
      });

      console.log(
        `Inserted chunk ${i++} into DB, total ${chunks.length}`,
        response
      );

      await sleep(1000);
    }
  }
};

const scrapePage = async (url: string) => {
  const loader = new PuppeteerWebBaseLoader(url, {
    launchOptions: {
      headless: true,
    },
    gotoOptions: {
      waitUntil: "domcontentloaded",
    },
    evaluate: async (page, browser) => {
      const result = await page.evaluate(() => document.body.innerText);
      await browser.close();
      return result;
    },
  });

  return (await loader.scrape())?.replace(/<[^>]*>?/gm, "");
};

createCollection().then(() => loadSampleData());
