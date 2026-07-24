"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { LifeBuoy, Paperclip, ChevronDown, Send } from "lucide-react";

import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { createRecord } from "@/lib/sync/repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatJalali } from "@/lib/jalali";
import type { SupportTicketCategory, SupportTicketMessage, SupportTicketPriority } from "@/lib/supabase/types";

const CATEGORY_LABELS: Record<SupportTicketCategory, string> = {
  chat: "گفتگو با پشتیبانی",
  technical: "مشکل فنی",
  veterinary: "مشاوره دامپزشکی",
  nutrition: "مشاوره تغذیه",
  callback: "درخواست تماس",
};

const PRIORITY_LABELS: Record<SupportTicketPriority, string> = {
  low: "کم",
  normal: "معمولی",
  high: "بالا",
  urgent: "فوری",
};

const STATUS_LABELS: Record<string, string> = {
  open: "باز",
  in_progress: "در حال بررسی",
  resolved: "حل‌شده",
  closed: "بسته‌شده",
};

const FAQ = [
  { q: "چطور یک تیکت پشتیبانی ثبت کنم؟", a: "از همین صفحه، فرم «تیکت جدید» را پر کنید و دسته‌بندی مناسب را انتخاب کنید." },
  { q: "چقدر طول می‌کشد تا پاسخ بگیرم؟", a: "بسته به اولویت تیکت، معمولاً ظرف ۲۴ تا ۴۸ ساعت پاسخ داده می‌شود." },
  { q: "آیا می‌توانم عکس یا فایل پیوست کنم؟", a: "بله، هنگام ثبت تیکت می‌توانید یک تصویر، ویدیو یا فایل PDF پیوست کنید." },
  { q: "برای درخواست تماس دامپزشک چه کار کنم؟", a: "دسته‌بندی «مشاوره دامپزشکی» یا «درخواست تماس» را انتخاب و توضیحات لازم را وارد کنید." },
];

function TicketThread({ ticketId }: { ticketId: string }) {
  const { session, profile } = useAuth();
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  async function loadMessages() {
    const { data } = await supabase
      .from("support_ticket_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    setMessages(data ?? []);
  }

  useEffect(() => {
    void loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  async function sendReply() {
    if (!reply.trim() || !session || !profile?.farm_id) return;
    setSending(true);
    const { error } = await supabase.from("support_ticket_messages").insert({
      ticket_id: ticketId,
      farm_id: profile.farm_id,
      sender_id: session.user.id,
      message: reply.trim(),
    });
    setSending(false);
    if (error) {
      toast.error(`ارسال پیام ناموفق بود: ${error.message}`);
      return;
    }
    setReply("");
    void loadMessages();
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-2">
      {messages.map((m) => (
        <div key={m.id} className="rounded-lg bg-muted p-2 text-sm">
          <p>{m.message}</p>
          <span className="text-xs text-muted-foreground">{formatJalali(m.created_at.slice(0, 10))}</span>
        </div>
      ))}
      {messages.length === 0 && <p className="text-xs text-muted-foreground">هنوز پیامی ثبت نشده است.</p>}
      <div className="flex gap-2">
        <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="پیام خود را بنویسید…" className="h-10 flex-1" />
        <Button size="icon" onClick={sendReply} disabled={sending} aria-label="ارسال">
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export default function SupportCenterPage() {
  const { profile, session } = useAuth();
  const [category, setCategory] = useState<SupportTicketCategory>("technical");
  const [priority, setPriority] = useState<SupportTicketPriority>("normal");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const tickets = useLiveQuery(async () => {
    if (!profile?.farm_id) return [];
    const rows = await db.support_tickets.where("farm_id").equals(profile.farm_id).toArray();
    return rows.filter((t) => !t.deleted_at).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }, [profile?.farm_id]);

  async function submitTicket() {
    if (!profile?.farm_id || !session || !title.trim() || !description.trim()) return;
    setSubmitting(true);
    console.log("[business/support] submitting ticket", { category, priority, title });

    try {
      let attachmentUrl: string | null = null;
      if (attachment) {
        if (!navigator.onLine) {
          toast.warning("چون آفلاین هستید، فایل پیوست بارگذاری نشد؛ تیکت بدون پیوست ثبت می‌شود");
        } else {
          const path = `${profile.farm_id}/${Date.now()}-${attachment.name}`;
          const { error } = await supabase.storage.from("support-attachments").upload(path, attachment);
          if (error) {
            console.error("[business/support] attachment upload failed", error);
            toast.warning("بارگذاری فایل ناموفق بود؛ تیکت بدون پیوست ثبت می‌شود");
          } else {
            attachmentUrl = path;
          }
        }
      }

      await createRecord("support_tickets", profile.farm_id, session.user.id, {
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        status: "open",
        attachment_url: attachmentUrl,
      });

      toast.success("تیکت با موفقیت ثبت شد");
      setTitle("");
      setDescription("");
      setAttachment(null);
    } catch (error) {
      console.error("[business/support] failed", error);
      toast.error(error instanceof Error ? error.message : "ثبت تیکت با خطا مواجه شد. لطفاً دوباره تلاش کنید.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <LifeBuoy className="size-6 text-primary" />
        <h1 className="text-xl font-bold">مرکز پشتیبانی گله‌یار</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>تیکت جدید</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Select value={category} onValueChange={(v) => setCategory(v as SupportTicketCategory)}>
            <SelectTrigger className="h-12 w-full text-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(CATEGORY_LABELS) as SupportTicketCategory[]).map((c) => (
                <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={(v) => setPriority(v as SupportTicketPriority)}>
            <SelectTrigger className="h-12 w-full text-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(PRIORITY_LABELS) as SupportTicketPriority[]).map((p) => (
                <SelectItem key={p} value={p}>اولویت {PRIORITY_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان" className="h-12 text-lg" />
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="توضیحات" rows={3} />
          <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-input text-muted-foreground">
            <Paperclip className="size-4" />
            {attachment ? attachment.name : "پیوست عکس، ویدیو یا PDF (اختیاری)"}
            <input
              type="file"
              accept="image/*,video/*,application/pdf"
              className="hidden"
              onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
            />
          </label>
          <Button size="lg" onClick={submitTicket} disabled={submitting || !title.trim() || !description.trim()}>
            {submitting ? "در حال ثبت…" : "ارسال تیکت"}
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">تیکت‌های من</h2>
        {(tickets ?? []).length === 0 && <p className="text-center text-muted-foreground">هنوز تیکتی ثبت نشده است.</p>}
        {(tickets ?? []).map((t) => (
          <Card key={t.id}>
            <button
              type="button"
              onClick={() => setOpenTicketId(openTicketId === t.id ? null : t.id)}
              className="flex w-full items-center justify-between p-3 text-start"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold">{t.title}</span>
                <span className="text-xs text-muted-foreground">
                  {CATEGORY_LABELS[t.category]} · {STATUS_LABELS[t.status]}
                </span>
              </div>
              <ChevronDown className={`size-4 shrink-0 transition-transform ${openTicketId === t.id ? "rotate-180" : ""}`} />
            </button>
            {openTicketId === t.id && (
              <CardContent className="pt-0">
                <p className="mb-2 text-sm">{t.description}</p>
                <TicketThread ticketId={t.id} />
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">سوالات متداول</h2>
        {FAQ.map((item, i) => (
          <Card key={i}>
            <button
              type="button"
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
              className="flex w-full items-center justify-between p-3 text-start"
            >
              <span className="text-sm font-semibold">{item.q}</span>
              <ChevronDown className={`size-4 shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
            </button>
            {openFaq === i && <CardContent className="pt-0 text-sm text-muted-foreground">{item.a}</CardContent>}
          </Card>
        ))}
      </div>
    </div>
  );
}
