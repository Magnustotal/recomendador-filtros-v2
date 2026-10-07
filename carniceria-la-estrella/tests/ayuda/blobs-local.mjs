// Servidor de Blobs real (el de @netlify/blobs) en un directorio temporal, para probar sin Netlify.
import { BlobsServer } from "@netlify/blobs/server";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function arrancarBlobs() {
  const directorio = mkdtempSync(join(tmpdir(), "blobs-"));
  const token = "token-de-prueba";
  const servidor = new BlobsServer({ directory: directorio, token });
  const { port } = await servidor.start();
  const contexto = { apiURL: `http://127.0.0.1:${port}`, edgeURL: `http://127.0.0.1:${port}`, uncachedEdgeURL: `http://127.0.0.1:${port}`, token, siteID: "sitio-de-prueba" };
  process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify(contexto)).toString("base64");
  return {
    contexto,
    async parar() { await servidor.stop(); rmSync(directorio, { recursive: true, force: true }); },
  };
}
