import { NextRequest } from "next/server";
import { Router } from "@/lib/http";
import { mountAccount } from "@/lib/api/account";
import { mountNutrition } from "@/lib/api/nutrition";
import { mountRecipeImport } from "@/lib/api/recipe-import";
import { mountBody } from "@/lib/api/body";
import { mountTraining } from "@/lib/api/training";
import { mountStats } from "@/lib/api/stats";
import { mountNotes } from "@/lib/api/notes";
import { mountAgent } from "@/lib/api/agent";
import { mountAdmin } from "@/lib/api/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const router = new Router();
[mountAccount, mountNutrition, mountRecipeImport, mountBody, mountTraining, mountStats, mountNotes, mountAgent, mountAdmin].forEach((m) => m(router));

type Ctx = { params: Promise<{ path: string[] }> };
const h = async (req: NextRequest, c: Ctx) => router.handle(req, (await c.params).path);
export { h as GET, h as POST, h as PUT, h as DELETE };
