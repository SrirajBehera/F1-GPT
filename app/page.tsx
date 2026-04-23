"use client";

import Image from "next/image";
import F1Logo from "./assets/f1-logo.png";
import { useState } from "react";

import { useChat } from "@ai-sdk/react";

import PromptSuggestionsRow from "./components/PromptSuggestionsRow";
import Bubble from "./components/Bubble";
import LoadingBubble from "./components/LoadingBubble";

const Home = () => {
  const { messages, sendMessage, status } = useChat();
  const [input, setInput] = useState("");

  const isLoading = status === "streaming" || status === "submitted";
  const noMessages = !messages || messages.length === 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput("");
  };

  const handlePrompt = (promptText: string) => {
    sendMessage({ text: promptText });
  };

  return (
    <main>
      <Image src={F1Logo} width={"250"} alt="F1 GPT Logo" />
      <section className={noMessages ? "" : "populated"}>
        {noMessages ? (
          <>
            <p>
              F1 GPT can answer all questions related to Formula 1. Give it a
              spin and enjoy the thrill. Beware, too much excitement can lock
              your tyres, lol.
            </p>
            <br />
            <PromptSuggestionsRow onPromptClick={handlePrompt} />
          </>
        ) : (
          <>
            {messages.map((message, index) => (
              <Bubble key={`message-${index}`} message={message} />
            ))}
            {isLoading && <LoadingBubble />}
          </>
        )}
      </section>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          className="question-box"
          onChange={(e) => setInput(e.target.value)}
          value={input}
          placeholder="Ask me anything..."
        />
        <input type="submit" />
      </form>
    </main>
  );
};

export default Home;
