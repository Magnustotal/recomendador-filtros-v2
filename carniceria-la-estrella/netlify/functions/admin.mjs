import { manejarAdmin } from "../../lib/api-admin.mjs";
import { dependencias } from "../../lib/dependencias.mjs";

export default async (req, context) => manejarAdmin(req, dependencias(context));

export const config = { path: "/api/admin/*", rateLimit: { windowSize: 60, windowLimit: 120, aggregateBy: ["ip", "domain"] } };
