// Same origin by default (Next.js API routes). Set NEXT_PUBLIC_API_URL only to point at another API.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

export type Inbox = {
  id: string;
  address: string;
  domain: string;
  is_custom: boolean;
  created_at: string;
  expires_at: string;
  token: string;
};

export type MessageSummary = {
  id: string;
  from_address: string | null;
  from_name: string | null;
  subject: string;
  preview: string;
  otp: string | null;
  has_attachments: boolean;
  received_at: string;
  read: boolean;
};

export type Attachment = { id: string; filename: string; content_type: string | null; size_bytes: number };

export type FullMessage = {
  id: string;
  from_address: string | null;
  from_name: string | null;
  subject: string;
  text: string | null;
  html: string | null;
  otp: string | null;
  size_bytes: number;
  received_at: string;
  attachments: Attachment[];
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function call<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        ...(rest.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { "X-Inbox-Token": token } : {}),
        ...headers,
      },
    });
  } catch {
    throw new ApiError(0, "network");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  domains: () => call<{ domains: string[]; ttl_choices: number[]; default_ttl: number }>("/api/domains"),
  create: (body: { username?: string; domain?: string; ttl_minutes?: number }) =>
    call<Inbox>("/api/inboxes", { method: "POST", body: JSON.stringify(body) }),
  inbox: (i: Pick<Inbox, "id" | "token">) => call<Omit<Inbox, "token">>(`/api/inboxes/${i.id}`, { token: i.token }),
  extend: (i: Pick<Inbox, "id" | "token">, ttl_minutes: number) =>
    call<Omit<Inbox, "token">>(`/api/inboxes/${i.id}/extend`, {
      method: "POST",
      token: i.token,
      body: JSON.stringify({ ttl_minutes }),
    }),
  remove: (i: Pick<Inbox, "id" | "token">) => call<void>(`/api/inboxes/${i.id}`, { method: "DELETE", token: i.token }),
  messages: (i: Pick<Inbox, "id" | "token">) =>
    call<{ messages: MessageSummary[]; expires_at: string }>(`/api/inboxes/${i.id}/messages`, { token: i.token }),
  message: (i: Pick<Inbox, "id" | "token">, mid: string) =>
    call<FullMessage>(`/api/inboxes/${i.id}/messages/${mid}`, { token: i.token }),
  removeMessage: (i: Pick<Inbox, "id" | "token">, mid: string) =>
    call<void>(`/api/inboxes/${i.id}/messages/${mid}`, { method: "DELETE", token: i.token }),
  /** Fetches the file with the inbox token and saves it through a temporary link. */
  download: async (i: Pick<Inbox, "id" | "token">, aid: string, filename: string) => {
    let res: Response;
    try {
      res = await fetch(`${API_URL}/api/inboxes/${i.id}/attachments/${aid}`, { headers: { "X-Inbox-Token": i.token } });
    } catch {
      throw new ApiError(0, "network");
    }
    if (!res.ok) throw new ApiError(res.status, "Download failed");
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  },
  simulate: (i: Pick<Inbox, "id" | "token">) =>
    call<{ id: string }>(`/api/inboxes/${i.id}/simulate`, { method: "POST", token: i.token }),
};
