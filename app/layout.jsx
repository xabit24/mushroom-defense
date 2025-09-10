export const metadata = {
  title: "Mushroom Defense (JS)",
  description: "Simple 3D tower defense with React Three Fiber",
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
