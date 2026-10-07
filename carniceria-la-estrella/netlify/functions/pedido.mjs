import { crearPedido } from "../../lib/api-publica.mjs";
import { dependencias } from "../../lib/dependencias.mjs";

export default async (req, context) => crearPedido(req, dependencias(context));

export const config = { path: "/api/pedido", method: ["POST"], rateLimit: { windowSize: 60, windowLimit: 8, aggregateBy: ["ip", "domain"] } };
