import { Router } from "express";
import { db } from "../firebase.js";

export const reportsRouter = Router();

reportsRouter.get("/summary", async (req, res) => {
  try {
    const clientsSnap = await db.collection("clients").get();
    let totalInteractions = 0;
    let totalFollowUps = 0;
    let realizedFollowUps = 0;
    let overdueFollowUps = 0;
    const today = new Date().toISOString().slice(0, 10);

    for (const clientDoc of clientsSnap.docs) {
      const interactionsSnap = await clientDoc.ref.collection("interactions").get();
      totalInteractions += interactionsSnap.size;

      const followupsSnap = await clientDoc.ref.collection("followups").get();
      totalFollowUps += followupsSnap.size;

      followupsSnap.forEach(doc => {
        const data = doc.data();
        if (data.status === "zrealizowane") realizedFollowUps++;
        else if (data.dueDate < today) overdueFollowUps++;
      });
    }

    res.json({
      totalClients: clientsSnap.size,
      totalInteractions,
      totalFollowUps,
      realizedFollowUps,
      overdueFollowUps
    });
  } catch (err) {
    console.error("Report error:", err);
    res.status(500).json({ error: "Failed to generate report" });
  }
});
