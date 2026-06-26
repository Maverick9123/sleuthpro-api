// TEMPORARY DEBUG — remove before App Store submission
import type { NextApiRequest, NextApiResponse } from "next";
import { callMelissa } from "@/lib/melissa";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const raw = await callMelissa({ full: "John Smith", state: "CA" });
    return res.status(200).json(raw);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
