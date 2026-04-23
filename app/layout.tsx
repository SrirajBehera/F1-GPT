import "./global.css";

export const metadata = {
  title: "F1 GPT",
  description: "Ask anything about Formula 1",
};

const RootLayout = ({ children }) => {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
};

export default RootLayout;
