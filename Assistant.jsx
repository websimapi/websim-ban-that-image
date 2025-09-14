import { jsxDEV } from "react/jsx-dev-runtime";
import React, { useState } from "react";
import { useCreator } from "./hooks.js";
import { generateOrGetTTS } from "./tts.js";
import { TTS_VOICE } from "./utils.js";
function Assistant() {
  const creator = useCreator();
  const [input, setInput] = useState("");
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);
  async function speak(text) {
    try {
      const res = await generateOrGetTTS(text, TTS_VOICE, creator);
      const audio = new Audio(res.url);
      audio.play();
    } catch (error) {
      console.error("TTS error:", error);
    }
  }
  async function send() {
    if (!input.trim()) return;
    const userMsg = { role: "user", content: input.trim() };
    const nextLog = [...log, userMsg];
    setLog(nextLog);
    setInput("");
    setBusy(true);
    try {
      const recent = nextLog.slice(-10);
      const completion = await window.websim.chat.completions.create({
        messages: [
          { role: "system", content: "You are Agent Ban, a concise, witty assistant who helps ban images and track Banjas. Keep answers brief and actionable." },
          ...recent
        ]
      });
      const aiMsg = { role: "assistant", content: completion.content };
      setLog([...nextLog, aiMsg]);
      speak(aiMsg.content);
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ jsxDEV("div", { className: "assistant", children: [
    /* @__PURE__ */ jsxDEV("header", { children: "Agent Ban" }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 48,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "chatlog", children: [
      log.map((m, i) => /* @__PURE__ */ jsxDEV("div", { className: `msg ${m.role === "user" ? "user" : "ai"}`, children: m.content }, i, false, {
        fileName: "<stdin>",
        lineNumber: 51,
        columnNumber: 11
      }, this)),
      log.length === 0 && /* @__PURE__ */ jsxDEV("div", { className: "msg ai", children: `Say "Start banning" and I'll guide you.` }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 54,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 49,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "inputrow", children: [
      /* @__PURE__ */ jsxDEV(
        "input",
        {
          placeholder: "Ask Agent Ban\u2026",
          value: input,
          onChange: (e) => setInput(e.target.value),
          onKeyDown: (e) => e.key === "Enter" ? send() : null
        },
        void 0,
        false,
        {
          fileName: "<stdin>",
          lineNumber: 58,
          columnNumber: 9
        },
        this
      ),
      /* @__PURE__ */ jsxDEV("button", { className: "btn", onClick: send, disabled: busy, children: busy ? "\u2026" : "Send" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 64,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 57,
      columnNumber: 7
    }, this)
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 47,
    columnNumber: 5
  }, this);
}
export {
  Assistant
};
