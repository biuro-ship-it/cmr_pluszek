import { Router } from "express";
import multer from "multer";
import { db, storage } from "../firebase.js";
import {
  CreateClientInput,
  Client,
  CreateInteractionInput,
  Interaction,
  CreateFollowUpInput,
  FollowUp
} from "../types.js";
import { sendEmail } from "../services/gmail.js";

const COLLECTION = "clients";
export const clientsRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

function toDateOnly(value: string) {
  return value.slice(0, 10);
}

function classifyFollowUp(dueDate: string) {
  const today = toDateOnly(new Date().toISOString());
  const due = toDateOnly(dueDate);
  if (due < today) return "zalegle";
  if (due === today) return "na_dzis";
  return "przyszle";
}

clientsRouter.get("/", async (_req, res) => {
  const snap = await db.collection(COLLECTION).orderBy("createdAt", "desc").get();
  const clients = snap.docs.map((doc) => doc.data() as Client);
  res.json(clients);
});

clientsRouter.post("/", async (req, res) => {
  const payload = req.body as CreateClientInput;
  if (!payload.companyName?.trim()) {
    return res.status(400).json({ error: "companyName is required" });
  }

  const now = new Date().toISOString();
  const ref = db.collection(COLLECTION).doc();
  const client: Client = {
    id: ref.id,
    companyName: payload.companyName.trim(),
    contactPersonName: payload.contactPersonName?.trim() ?? "",
    email: payload.email?.trim() ?? "",
    phone: payload.phone?.trim() ?? "",
    address: payload.address?.trim() ?? "",
    createdAt: now,
    updatedAt: now,
    lastContactAt: now
  };

  await ref.set(client);
  return res.status(201).json(client);
});

clientsRouter.put("/:id", async (req, res) => {
  const id = req.params.id;
  const updates = req.body as Partial<CreateClientInput>;
  const ref = db.collection(COLLECTION).doc(id);
  const existing = await ref.get();

  if (!existing.exists) {
    return res.status(404).json({ error: "Client not found" });
  }

  const rawUpdateData = {
    companyName: updates.companyName?.trim(),
    contactPersonName: updates.contactPersonName?.trim(),
    email: updates.email?.trim(),
    phone: updates.phone?.trim(),
    address: updates.address?.trim(),
    updatedAt: new Date().toISOString()
  };
  const updateData = Object.fromEntries(
    Object.entries(rawUpdateData).filter(([, value]) => value !== undefined)
  );

  await ref.update(updateData);
  const updated = await ref.get();
  return res.json(updated.data());
});

clientsRouter.delete("/:id", async (req, res) => {
  const id = req.params.id;
  await db.collection(COLLECTION).doc(id).delete();
  return res.status(204).send();
});

clientsRouter.get("/:id/interactions", async (req, res) => {
  const clientId = req.params.id;
  const snap = await db
    .collection(COLLECTION)
    .doc(clientId)
    .collection("interactions")
    .orderBy("contactDate", "desc")
    .get();

  const interactions = snap.docs.map((doc) => doc.data() as Interaction);
  return res.json(interactions);
});

clientsRouter.post("/:id/interactions", async (req, res) => {
  const clientId = req.params.id;
  const payload = req.body as CreateInteractionInput;
  const clientRef = db.collection(COLLECTION).doc(clientId);
  const clientDoc = await clientRef.get();

  if (!clientDoc.exists) {
    return res.status(404).json({ error: "Client not found" });
  }

  if (!payload.contactDate || !payload.channel) {
    return res.status(400).json({ error: "contactDate and channel are required" });
  }

  const now = new Date().toISOString();
  const interactionRef = clientRef.collection("interactions").doc();
  const interaction: Interaction = {
    id: interactionRef.id,
    clientId,
    contactDate: payload.contactDate,
    channel: payload.channel,
    notes: payload.notes?.trim() ?? "",
    pricingNotes: payload.pricingNotes?.trim() ?? "",
    products: payload.products?.trim() ?? "",
    createdAt: now
  };

  await interactionRef.set(interaction);
  await clientRef.update({
    lastContactAt: payload.contactDate,
    updatedAt: now
  });

  return res.status(201).json(interaction);
});

clientsRouter.get("/:id/followups", async (req, res) => {
  const clientId = req.params.id;
  const snap = await db
    .collection(COLLECTION)
    .doc(clientId)
    .collection("followups")
    .orderBy("dueDate", "asc")
    .get();

  const followups = snap.docs.map((doc) => doc.data() as FollowUp);
  return res.json(followups);
});

clientsRouter.post("/:id/followups", async (req, res) => {
  const clientId = req.params.id;
  const payload = req.body as CreateFollowUpInput;
  const clientRef = db.collection(COLLECTION).doc(clientId);
  const clientDoc = await clientRef.get();

  if (!clientDoc.exists) {
    return res.status(404).json({ error: "Client not found" });
  }
  if (!payload.dueDate) {
    return res.status(400).json({ error: "dueDate is required" });
  }

  const now = new Date().toISOString();
  const followUpRef = clientRef.collection("followups").doc();
  const followUp: FollowUp = {
    id: followUpRef.id,
    clientId,
    dueDate: payload.dueDate,
    note: payload.note?.trim() ?? "",
    status: "zaplanowane",
    createdAt: now,
    updatedAt: now
  };

  await followUpRef.set(followUp);
  await clientRef.update({ updatedAt: now });
  return res.status(201).json(followUp);
});

clientsRouter.patch("/:id/followups/:followUpId/status", async (req, res) => {
  const { id, followUpId } = req.params;
  const status = req.body?.status as FollowUp["status"] | undefined;
  if (!status || !["zaplanowane", "zrealizowane", "przesuniete"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const ref = db.collection(COLLECTION).doc(id).collection("followups").doc(followUpId);
  const existing = await ref.get();
  if (!existing.exists) {
    return res.status(404).json({ error: "Follow-up not found" });
  }

  await ref.update({ status, updatedAt: new Date().toISOString() });
  const updated = await ref.get();
  return res.json(updated.data());
});

clientsRouter.get("/followups/summary", async (_req, res) => {
  const clientsSnap = await db.collection(COLLECTION).get();
  const today: Array<{ clientId: string; companyName: string; dueDate: string; note: string }> = [];
  const overdue: Array<{ clientId: string; companyName: string; dueDate: string; note: string }> = [];

  for (const clientDoc of clientsSnap.docs) {
    const client = clientDoc.data() as Client;
    const followupsSnap = await clientDoc.ref.collection("followups").get();
    for (const doc of followupsSnap.docs) {
      const followup = doc.data() as FollowUp;
      if (followup.status === "zrealizowane") continue;
      const item = {
        clientId: client.id,
        companyName: client.companyName,
        dueDate: followup.dueDate,
        note: followup.note
      };
      const classification = classifyFollowUp(followup.dueDate);
      if (classification === "na_dzis") today.push(item);
      if (classification === "zalegle") overdue.push(item);
    }
  }

  return res.json({ today, overdue });
});

clientsRouter.post("/:id/send-email", async (req, res) => {
  const { id } = req.params;
  const { type, attachPdf } = req.body;
  
  const clientDoc = await db.collection(COLLECTION).doc(id).get();
  if (!clientDoc.exists) {
    return res.status(404).json({ error: "Client not found" });
  }
  
  const client = clientDoc.data() as Client;
  if (!client.email) {
    return res.status(400).json({ error: "Client has no email address" });
  }

  let subject = "";
  let text = "";

  if (type === "katalog") {
    subject = "Nasz najnowszy katalog produktów";
    text = `Dzień dobry ${client.contactPersonName || client.companyName},<br><br>Przesyłamy nasz najnowszy katalog produktów.<br><br>Pozdrawiamy,<br>Zespół CRM`;
  } else if (type === "podsumowanie") {
    subject = "Podsumowanie ustaleń handlowych";
    text = `Dzień dobry ${client.contactPersonName || client.companyName},<br><br>Dziękujemy za kontakt. Poniżej przesyłamy podsumowanie naszych ustaleń.<br><br>Pozdrawiamy,<br>Zespół CRM`;
  }

  try {
    await sendEmail({ to: client.email, subject, text, attachPdf });
    res.json({ success: true });
  } catch (err) {
    console.error("Email error:", err);
    res.status(500).json({ error: "Failed to send email" });
  }
});

clientsRouter.post("/:id/attachments", upload.single("file"), async (req, res) => {
  const { id } = req.params;
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const clientRef = db.collection(COLLECTION).doc(id);
    const clientDoc = await clientRef.get();
    if (!clientDoc.exists) return res.status(404).json({ error: "Client not found" });

    const bucket = storage.bucket();
    const filePath = `clients/${id}/${Date.now()}_${file.originalname}`;
    const blob = bucket.file(filePath);
    
    await blob.save(file.buffer, {
      contentType: file.mimetype,
      metadata: { firebaseStorageDownloadTokens: id }
    });

    const attachment = {
      id: Buffer.from(filePath).toString('base64'),
      name: file.originalname,
      path: filePath,
      mimetype: file.mimetype,
      size: file.size,
      createdAt: new Date().toISOString()
    };

    await clientRef.collection("attachments").doc(attachment.id).set(attachment);
    res.status(201).json(attachment);
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

clientsRouter.get("/:id/attachments", async (req, res) => {
  const { id } = req.params;
  const snap = await db.collection(COLLECTION).doc(id).collection("attachments").get();
  const attachments = snap.docs.map(doc => doc.data());
  res.json(attachments);
});

clientsRouter.delete("/:id/attachments/:fileId", async (req, res) => {
  const { id, fileId } = req.params;
  try {
    const docRef = db.collection(COLLECTION).doc(id).collection("attachments").doc(fileId);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: "Attachment not found" });

    const data = doc.data();
    await storage.bucket().file(data?.path).delete();
    await docRef.delete();
    res.status(204).send();
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: "Delete failed" });
  }
});
