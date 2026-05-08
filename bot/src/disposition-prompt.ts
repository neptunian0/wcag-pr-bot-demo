import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are reviewing how a developer responded to an automated WCAG accessibility finding posted on a pull request. Given:
- The original finding (WCAG criterion, severity, title)
- The comment thread (the bot's original comment plus any developer replies)
- The final state of the file in the merged PR

Classify the disposition into ONE of:

- **fixed**: The issue was addressed in code. You can identify a change in the final file that resolves the finding (e.g. an \`alt\` attribute was added; an icon button got an \`aria-label\`; a placeholder-only input now has a \`<label>\`).
- **legitimately_dismissed**: The developer dismissed the finding with substantive reasoning. This includes citing a WCAG exception (e.g. the process exception, a decorative element, a runtime assistive-tech behaviour the static check misses), explaining why the static analysis was wrong for this case, or linking a follow-up ticket with a clear plan.
- **weak_dismissal**: The developer dismissed without substantive reasoning. Markers include "will fix later" with no ticket, "not a real issue" with no explanation, "tracked elsewhere" with no link, or vague hand-waves. The defining feature is the absence of a concrete plan or rationale.
- **unaddressed**: The bot comment received no reply and the issue is still present in the final file.

Be conservative. If the developer's reasoning cites something concrete — a specific WCAG note, a ticket ID, a follow-up plan — prefer "legitimately_dismissed". If they merely deferred without specifics, prefer "weak_dismissal".

Output via the \`submit_disposition\` tool. Provide a confidence rating and 1–2 sentences of reasoning that cite specific evidence from the thread or the final file.`;

const TOOL = {
  name: "submit_disposition",
  description: "Submit the classified disposition for the finding. Call exactly once.",
  input_schema: {
    type: "object" as const,
    properties: {
      disposition: {
        type: "string",
        enum: ["fixed", "legitimately_dismissed", "weak_dismissal", "unaddressed"]
      },
      classifierConfidence: { type: "string", enum: ["high", "medium", "low"] },
      reasoning: {
        type: "string",
        description: "1-2 sentences citing specific evidence from the thread or final file."
      }
    },
    required: ["disposition", "classifierConfidence", "reasoning"]
  }
};

export interface ClassifyInput {
  finding: {
    sc: string;
    severity: string;
    confidence: string;
    title: string;
  };
  thread: Array<{ author: string; body: string; created_at: string }>;
  filePath: string;
  finalContent: string;
  prMerged: boolean;
}

export interface ClassifyResult {
  disposition: "fixed" | "legitimately_dismissed" | "weak_dismissal" | "unaddressed";
  classifierConfidence: "high" | "medium" | "low";
  reasoning: string;
}

export async function classifyDisposition(
  anthropic: Anthropic,
  input: ClassifyInput
): Promise<ClassifyResult> {
  const threadMd = input.thread
    .map((m, i) =>
      i === 0
        ? `### Bot finding\n\n${m.body}`
        : `### Reply by ${m.author} at ${m.created_at}\n\n${m.body}`
    )
    .join("\n\n");

  const userMsg = `## Original finding

- File: ${input.filePath}
- WCAG SC: ${input.finding.sc}
- Severity: ${input.finding.severity}
- Bot's confidence: ${input.finding.confidence}
- Title: ${input.finding.title}

## Comment thread

${threadMd}

## Final file state${input.prMerged ? "" : " (PR not merged)"}

\`\`\`
${input.finalContent}
\`\`\`

Classify the disposition.`;

  const model = process.env.WCAG_BOT_CLASSIFIER_MODEL ?? "claude-opus-4-7";

  const resp = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "submit_disposition" },
    messages: [{ role: "user", content: userMsg }]
  });

  const toolUse = resp.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return {
      disposition: "unaddressed",
      classifierConfidence: "low",
      reasoning: "Classifier did not call the tool; defaulting to unaddressed."
    };
  }
  return toolUse.input as ClassifyResult;
}
