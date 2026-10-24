import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createOpenAI } from "npm:@ai-sdk/openai";
import { streamText } from "npm:ai";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
} from "./run-id.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const GATEWAY_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const GATEWAY_BASE_URL = "https://ai.gateway.lovable.dev";
const MODEL = "openai/gpt-6-astra";

const MAX_LOG_RECORDS = 400;
const PAGE_SIZE = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");
const formatIST = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + IST_OFFSET_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} IST`;
};

const SYSTEM_PROMPT = `You are an assistant that helps school administrators understand attendance change history.
You answer ONLY from the change records provided in the message. Never invent names, dates, classes or events.
Structure the answer: a one-line overview first, then short bullet points grouped by class and attendance date. For each change give: the person, what they did (marked / updated / deleted), the class (program - grade - division), the attendance date and topic, and the time in IST.
If two people touched the same class on the same date, call that out.
If no records match the scope, say clearly that no attendance changes were found.
Keep the answer concise, factual and easy to read.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Authenticate the caller and require the admin role.
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Forbidden: admin role required" }, 403);

    // Validate the request body.
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid request body" }, 400);

    const schoolId = typeof body.schoolId === "string" ? body.schoolId : "";
    const classId = typeof body.classId === "string" ? body.classId : "";
    const fromDate = typeof body.fromDate === "string" ? body.fromDate : "";
    const toDate = typeof body.toDate === "string" ? body.toDate : "";
    const question = typeof body.question === "string" ? body.question.trim().slice(0, 500) : "";

    if ((schoolId && !UUID_RE.test(schoolId)) || (classId && !UUID_RE.test(classId))) {
      return json({ error: "Invalid school or class" }, 400);
    }
    if (!DATE_RE.test(fromDate) || !DATE_RE.test(toDate) || fromDate > toDate) {
      return json({ error: "A valid date range is required" }, 400);
    }

    // Resolve the scope: school name and the classes inside it.
    let schoolName = "All schools";
    if (schoolId) {
      const { data: school } = await admin.from("schools").select("name").eq("id", schoolId).maybeSingle();
      if (!school) return json({ error: "School not found" }, 400);
      schoolName = school.name;
    }

    let classQuery = admin.from("classes").select("id, name, grade, div");
    if (schoolId) classQuery = classQuery.eq("school_id", schoolId);
    if (classId) classQuery = classQuery.eq("id", classId);
    const { data: scopeClasses, error: classesErr } = await classQuery.order("name");
    if (classesErr) return json({ error: "Could not load classes for this scope" }, 500);
    if (classId && (!scopeClasses || scopeClasses.length === 0)) {
      return json({ error: "Class not found in the selected school" }, 400);
    }

    // Class names as they appear in log descriptions: "Program - Grade - Division".
    // Only fall back to the bare program name when grade/division are missing,
    // so a VII-A query never picks up records of VII-B of the same program.
    const scopeClassNames = new Set<string>();
    for (const c of scopeClasses ?? []) {
      if (c.grade && c.div) {
        scopeClassNames.add(`${c.name} - ${c.grade} - ${c.div}`);
      } else {
        scopeClassNames.add(c.name);
      }
    }

    // Pull the attendance change history for the date range.
    const toExclusive = new Date(`${toDate}T00:00:00Z`);
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);

    const allLogs: { user_name: string; action: string; description: string; created_at: string }[] = [];
    let offset = 0;
    while (allLogs.length < MAX_LOG_RECORDS) {
      const { data, error } = await admin
        .from("activity_logs")
        .select("user_name, action, description, created_at")
        .eq("section", "attendance")
        .in("action", ["created", "updated", "deleted"])
        .gte("created_at", `${fromDate}T00:00:00Z`)
        .lt("created_at", toExclusive.toISOString())
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) return json({ error: "Could not load the change history" }, 500);

      const batch = data ?? [];
      allLogs.push(...batch.map((r) => ({
        user_name: r.user_name,
        action: r.action,
        description: r.description,
        created_at: r.created_at,
      })));
      if (batch.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    // Keep only records that belong to the selected scope's classes.
    const matchesScope = (description: string) =>
      scopeClassNames.size === 0 || [...scopeClassNames].some((n) => description.includes(n));
    const scopedLogs = allLogs.filter((l) => matchesScope(l.description)).slice(0, MAX_LOG_RECORDS);

    const recordLines = scopedLogs
      .map((l) => `[${formatIST(l.created_at)}] ${l.user_name} | ${l.action} | ${l.description}`)
      .join("\n");

    const scopeLine = [
      `- School: ${schoolName}`,
      `- Class: ${classId ? ((scopeClasses ?? [])[0] ? `${(scopeClasses ?? [])[0].name}${(scopeClasses ?? [])[0].grade && (scopeClasses ?? [])[0].div ? ` - ${(scopeClasses ?? [])[0].grade} - ${(scopeClasses ?? [])[0].div}` : ""}` : "Selected class") : "All classes at this school"}`,
      `- Date range (when changes were recorded): ${fromDate} to ${toDate} (IST)`,
    ].join("\n");

    const userPrompt = `Scope:\n${scopeLine}\n\nQuestion: ${question || "Who made attendance changes in this scope, and when?"}\n\nChange records (most recent first, times in IST):\n${recordLines || "(no records)"}${allLogs.length > MAX_LOG_RECORDS ? `\n\n(Note: only the most recent ${MAX_LOG_RECORDS} records were included.)` : ""}\n\nAnswer the question using only these records.`;

    // Ask the model. The gateway leg is streamed; we consume the final text.
    const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(req));
    const provider = createOpenAI({
      baseURL: `${GATEWAY_BASE_URL.replace(/\/v1$/, "")}/v1`,
      apiKey: GATEWAY_API_KEY,
      headers: { "Lovable-API-Key": GATEWAY_API_KEY, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });

    const result = streamText({
      model: provider.responses(MODEL),
      instructions: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      abortSignal: req.signal,
      providerOptions: {
        openai: {
          store: false,
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          include: ["reasoning.encrypted_content"],
        },
      },
    });

    const answer = (await result.text).trim();
    if (!answer) return json({ error: "The assistant returned an empty answer. Please try again." }, 502);

    return json({
      answer,
      recordsAnalyzed: scopedLogs.length,
      scope: { school: schoolName, classId: classId || null, fromDate, toDate },
    });
  } catch (e) {
    console.error("attendance-qa error", e);
    const status = typeof (e as { statusCode?: number })?.statusCode === "number"
      ? (e as { statusCode: number }).statusCode
      : 500;
    const message = (e as Error)?.message || "Something went wrong while analyzing the history.";
    return json({ error: message }, status >= 400 && status < 600 ? status : 500);
  }
});
