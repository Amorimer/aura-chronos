"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type FileUIPart, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { ToolPart } from "./tool-cards";
import { imageToDataUrl, toWavDataUrl } from "@/lib/media";
import { boldRuns } from "@/lib/rich-text";
import { IconImage, IconMic, IconSend, IconStop, IconX } from "./icons";

const SUGGESTIONS = [
  "Dentista quinta às 15h",
  "Como está minha semana?",
  "Me lembra de pagar a luz todo dia 10",
  "Preciso comprar ração do cachorro",
];

export function Chat({ initialMessages, assistantName, userName }: { initialMessages: UIMessage[]; assistantName: string; userName: string }) {
  const { messages, sendMessage, status, error, stop } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages }) => ({ body: { message: messages[messages.length - 1] } }),
    }),
  });
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<FileUIPart[]>([]);
  const [recording, setRecording] = useState<null | { started: number }>(null);
  const [elapsed, setElapsed] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, status]);
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => {
      const s = Math.floor((Date.now() - recording.started) / 1000);
      setElapsed(s);
      if (s >= 120) stopRecording(true);
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  function autosize() {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }

  function submit(text?: string) {
    const t = (text ?? input).trim();
    if (busy || (!t && files.length === 0)) return;
    if (files.length) sendMessage(t ? { text: t, files } : { files });
    else sendMessage({ text: t });
    setInput("");
    setFiles([]);
    requestAnimationFrame(autosize);
  }

  async function onPickImages(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list).filter((f) => f.type.startsWith("image/")).slice(0, 4 - files.length);
    const parts = await Promise.all(picked.map(async (f) => ({
      type: "file" as const, mediaType: "image/jpeg", filename: f.name, url: await imageToDataUrl(f),
    })));
    setFiles((cur) => [...cur, ...parts].slice(0, 4));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function startRecording() {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      rec.start();
      recRef.current = rec;
      setElapsed(0);
      setRecording({ started: Date.now() });
      navigator.vibrate?.(30);
    } catch {
      setMicError("Não consegui usar o microfone. Libere o acesso nas permissões do navegador.");
    }
  }

  function stopRecording(send: boolean) {
    const rec = recRef.current;
    if (!rec) return;
    rec.onstop = async () => {
      rec.stream.getTracks().forEach((t) => t.stop());
      recRef.current = null;
      setRecording(null);
      if (!send || chunks.current.length === 0) return;
      try {
        const url = await toWavDataUrl(new Blob(chunks.current, { type: rec.mimeType }));
        const audio: FileUIPart = { type: "file", mediaType: "audio/wav", filename: "audio.wav", url };
        const t = input.trim();
        sendMessage(t ? { text: t, files: [audio, ...files] } : { files: [audio, ...files] });
        setInput("");
        setFiles([]);
      } catch {
        setMicError("Não consegui processar o áudio. Tente de novo.");
      }
    };
    rec.stop();
  }

  const empty = messages.length === 0;

  return (
    <div className="flex-1 flex flex-col">
      <header className="sticky top-0 z-20 bg-bg/90 backdrop-blur pt-safe">
        <div className="h-14 px-5 flex items-center justify-between">
          <h1 className="text-[17px] font-semibold">{assistantName}</h1>
          {busy && <span className="text-xs text-muted">pensando…</span>}
        </div>
      </header>

      <div className="flex-1 px-4 pb-4" aria-live="polite">
        {empty && (
          <div className="pt-10 pb-6">
            <p className="text-[22px] leading-7 font-semibold">Oi{userName ? `, ${userName}` : ""}! O que tem pela frente?</p>
            <p className="mt-2 text-muted text-[15px] leading-6">
              Escreva do jeito que vier, mande um print de convite ou segure o microfone e fale. Eu coloco na agenda, na lista de tarefas ou nas notas.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => submit(s)}
                  className="px-4 h-10 rounded-full border border-line bg-surface text-sm hover:border-accent">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <ol className="flex flex-col gap-3 pt-2">
          {messages.map((m) => (
            <li key={m.id} className={`flex flex-col gap-2 ${m.role === "user" ? "items-end" : "items-start"}`}>
              {m.parts.map((p, i) => {
                if (p.type === "text" && p.text.trim()) {
                  return (
                    <div key={i}
                      className={`max-w-[85%] whitespace-pre-wrap break-words text-[15px] leading-[22px] px-4 py-2.5 rounded-2xl ${
                        m.role === "user" ? "bg-bubble-user text-on-bubble-user rounded-br-md" : "bg-surface border border-line rounded-bl-md"}`}>
                      {boldRuns(p.text).map((r, j) => (r.bold ? <strong key={j} className="font-semibold">{r.text}</strong> : r.text))}
                    </div>
                  );
                }
                if (p.type === "file" && p.mediaType?.startsWith("image/")) {
                  // eslint-disable-next-line @next/next/no-img-element
                  return <img key={i} src={p.url} alt={p.filename ?? "imagem enviada"} className="max-w-[60%] max-h-64 rounded-2xl border border-line object-cover" />;
                }
                if (p.type === "file" && p.mediaType?.startsWith("audio/")) {
                  return <audio key={i} src={p.url} controls className="max-w-[80%] h-10" />;
                }
                if (p.type.startsWith("tool-")) return <ToolPart key={i} part={p as never} />;
                return null;
              })}
            </li>
          ))}
          {status === "submitted" && (
            <li className="flex"><div className="px-4 py-3 rounded-2xl bg-surface border border-line flex gap-1" aria-label="Pensando">
              <span className="dot w-1.5 h-1.5 rounded-full bg-muted" /><span className="dot w-1.5 h-1.5 rounded-full bg-muted" /><span className="dot w-1.5 h-1.5 rounded-full bg-muted" />
            </div></li>
          )}
          {error && (
            <li role="alert" className="text-sm text-danger bg-danger-soft rounded-xl px-4 py-3">
              Algo deu errado ao falar com o assistente. Tente mandar de novo.
            </li>
          )}
        </ol>
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 bg-bg/95 backdrop-blur px-3 pt-2 pb-3 border-t border-line">
        {micError && <p role="alert" className="text-xs text-danger mb-2 px-1">{micError}</p>}
        {files.length > 0 && (
          <div className="flex gap-2 mb-2 overflow-x-auto">
            {files.map((f, i) => (
              <div key={i} className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt="" className="w-16 h-16 rounded-xl object-cover border border-line" />
                <button aria-label="Remover imagem" onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-ink text-bg grid place-items-center"><IconX size={14} /></button>
              </div>
            ))}
          </div>
        )}
        {recording ? (
          <div className="flex items-center gap-3 h-12">
            <button onClick={() => stopRecording(false)} className="h-12 px-4 rounded-full text-sm text-muted">Cancelar</button>
            <div className="flex-1 flex items-center justify-center gap-2 text-sm font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-danger animate-pulse" />
              Gravando {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
            </div>
            <button onClick={() => stopRecording(true)} aria-label="Enviar áudio"
              className="w-12 h-12 rounded-full bg-accent text-on-accent grid place-items-center"><IconSend /></button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onPickImages(e.target.files)} />
            <button onClick={() => fileRef.current?.click()} aria-label="Enviar imagem ou print" disabled={files.length >= 4}
              className="w-11 h-11 shrink-0 rounded-full grid place-items-center text-muted hover:text-ink disabled:opacity-40"><IconImage size={22} /></button>
            <label className="flex-1">
              <span className="sr-only">Mensagem</span>
              <textarea ref={taRef} rows={1} value={input} placeholder="Escreva, mande um print ou fale…"
                onChange={(e) => { setInput(e.target.value); autosize(); }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) { e.preventDefault(); submit(); } }}
                className="w-full resize-none rounded-3xl bg-surface border border-line-input px-4 py-[11px] leading-[22px] max-h-40" />
            </label>
            {busy ? (
              <button onClick={() => stop()} aria-label="Parar" className="w-11 h-11 shrink-0 rounded-full bg-surface-2 grid place-items-center"><IconStop /></button>
            ) : input.trim() || files.length ? (
              <button onClick={() => submit()} aria-label="Enviar" className="w-11 h-11 shrink-0 rounded-full bg-accent text-on-accent grid place-items-center"><IconSend /></button>
            ) : (
              <button onClick={startRecording} aria-label="Gravar áudio" className="w-11 h-11 shrink-0 rounded-full bg-accent text-on-accent grid place-items-center"><IconMic /></button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
