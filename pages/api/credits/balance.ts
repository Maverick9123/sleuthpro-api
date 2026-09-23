import type { NextApiRequest, NextApiResponse } from "next";
import { installId, balanceOf } from "../../../lib/entitlement";

/**
 * What this install actually has, according to the server.
 *
 * The number shown in the app is a MIRROR of this, not the source of truth.
 * Call it on launch and after a purchase so a reinstall recovers the balance
 * rather than appearing to lose it.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const install = installId(req.headers);
  if (!install) return res.status(400).json({ error: "Missing install id." });
  const bal = await balanceOf(install);
  return res.status(200).json(bal);
}
