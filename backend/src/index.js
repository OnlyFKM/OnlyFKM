import express from "express";
import cors from "cors";
import { router } from "./routes/users.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", router);

app.listen(PORT, () => {
  console.log(`OnlyFKM backend escuchando en http://localhost:${PORT}`);
});
