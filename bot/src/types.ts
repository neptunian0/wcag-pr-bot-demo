export interface Finding {
  file: string;
  line: number;
  wcag_sc: string;
  severity: "blocking" | "non-blocking";
  confidence: "high" | "medium" | "low";
  title: string;
  message: string;
  code_snippet: string;
}

export interface DiffInput {
  path: string;
  patch: string;
}
