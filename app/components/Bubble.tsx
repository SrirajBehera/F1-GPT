import { UIMessage } from "ai";

const Bubble = ({ message }: { message: UIMessage }) => {
  const text = message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { type: "text"; text: string }).text)
    .join("");

  return <div className={`${message.role} bubble`}>{text}</div>;
};

export default Bubble;
