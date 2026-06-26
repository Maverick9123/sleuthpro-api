// SleuthPro API — Status Page
export default function Home() {
  return (
    <main style={{ fontFamily: "monospace", padding: "40px", maxWidth: "600px" }}>
      <h1>SleuthPro API</h1>
      <p>DreamTeamApps LLC — Backend API for SleuthPro iOS app</p>
      <h2>Endpoints</h2>
      <ul>
        <li>GET  /api/health</li>
        <li>POST /api/search/name</li>
        <li>POST /api/search/phone</li>
        <li>POST /api/search/email</li>
        <li>POST /api/search/address</li>
      </ul>
    </main>
  );
}