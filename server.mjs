import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.PORT) || 4173;
const root = path.dirname(fileURLToPath(import.meta.url));
const hrsaUrl = "https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv";

app.get("/healthz", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/api/hrsa-sites", async (_request, response) => {
  try {
    const upstream = await fetch(hrsaUrl);
    if (!upstream.ok) {
      response.status(upstream.status).json({ error: `HRSA dataset request failed (${upstream.status}).` });
      return;
    }
    const csv = await upstream.text();
    response.set("Cache-Control", "public, max-age=3600");
    response.type("text/csv").send(csv);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown upstream error";
    response.status(502).json({ error: `Unable to retrieve the HRSA dataset: ${message}` });
  }
});

app.use(express.static(path.join(root, "dist")));
app.get(/.*/, (_request, response) => {
  response.sendFile(path.join(root, "dist", "index.html"));
});

app.listen(port, () => {
  console.log(`Fair Care server listening on http://localhost:${port}`);
});
