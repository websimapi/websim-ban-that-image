import { jsxDEV } from "react/jsx-dev-runtime";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { WebsimSocket, useQuery } from "@websim/use-query";
const room = new WebsimSocket();
const GALLERY = "gallery_image";
const BANSTATE = "ban_state";
function useCurrentUser() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    (async () => setUser(await window.websim.getCurrentUser()))();
  }, []);
  return user;
}
function calcBounty(created_at) {
  const hours = Math.floor((Date.now() - new Date(created_at).getTime()) / 36e5);
  return Math.max(0, Math.min(3, hours));
}
function useToast() {
  const [msg, setMsg] = useState("");
  const [show, setShow] = useState(false);
  const timeout = useRef();
  const api = (text) => {
    setMsg(text);
    setShow(true);
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setShow(false), 2200);
  };
  return { msg, show, push: api };
}
const tutorialImage = {
  id: "tutorial",
  url: "",
  title: "Tutorial Image",
  created_at: new Date(Date.now() - 36e5).toISOString(),
  // 1 hour ago => 1 Banja
  owner_id: "system"
};
function App() {
  const user = useCurrentUser();
  const { data: images = [], loading: loadingImages } = useQuery(room.collection(GALLERY));
  const { data: states = [], loading: loadingState } = useQuery(user ? room.collection(BANSTATE).filter({ id: user.id }) : null);
  const banState = states?.[0];
  const toast = useToast();
  const [ttsVoice, setTtsVoice] = useState("en-male");
  const [showTutorial, setShowTutorial] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [tImageUrl, setTImageUrl] = useState("");
  useEffect(() => {
    if (!tImageUrl) {
      setTImageUrl("https://images.unsplash.com/photo-1511765224389-37f0e77cf0eb?w=800&q=60");
    }
  }, [tImageUrl]);
  const gallery = useMemo(() => {
    const enriched = images.map((im) => ({
      ...im,
      bounty: calcBounty(im.created_at)
    }));
    return enriched.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [images]);
  const totalScore = banState?.score || 0;
  const bannedList = banState?.data?.bans || [];
  async function ensureBanState() {
    if (!user) return;
    if (!banState) {
      await room.collection(BANSTATE).upsert({ id: user.id, score: 0, data: { bans: [] } });
    }
  }
  async function banImage(img, isTutorial = false) {
    if (!user) return;
    await ensureBanState();
    if (!isTutorial && img.user_id === user.id) {
      toast.push("You can't ban your own image.");
      return;
    }
    const already = bannedList.some((b) => b.image_id === img.id);
    if (already) {
      toast.push("Already banned.");
      return;
    }
    const createdAt = isTutorial ? tutorialImage.created_at : img.created_at;
    const url = isTutorial ? tImageUrl : img.url;
    const bounty = isTutorial ? 1 : calcBounty(createdAt);
    const newEntry = {
      image_id: img.id,
      url,
      original_posted_at: createdAt,
      banned_at: (/* @__PURE__ */ new Date()).toISOString(),
      bounty
    };
    const newScore = (banState?.score || 0) + bounty;
    const newBans = [...bannedList, newEntry];
    await room.collection(BANSTATE).upsert({
      id: user.id,
      score: newScore,
      data: { bans: newBans }
    });
    toast.push(`Banned for +${bounty} Banja${bounty !== 1 ? "s" : ""}`);
    if (isTutorial) setShowTutorial(false);
  }
  async function handleUpload(file) {
    if (!file) return;
    try {
      const url = await window.websim.upload(file);
      await room.collection(GALLERY).upsert({ url });
      toast.push("Uploaded. It will gain bounty over time.");
    } catch (e) {
      console.error(e);
      toast.push("Upload failed.");
    }
  }
  async function playTutorial() {
    const script = [
      "Agent Ban here. Your mission is simple: Ban images in the gallery.",
      "Every hour an image exists, its bounty increases by one, up to three Banjas.",
      "You cannot ban your own uploads. Nice try.",
      "Click Ban on the tutorial image below to earn your first Banja.",
      "You can chat with me anytime in the bottom right. Change my voice too."
    ];
    try {
      setPlaying(true);
      for (const line of script) {
        const res = await window.websim.textToSpeech({ text: line, voice: ttsVoice });
        const audio = new Audio(res.url);
        await new Promise((resolve) => {
          audio.onended = resolve;
          audio.play();
        });
      }
    } finally {
      setPlaying(false);
    }
  }
  if (!user) return /* @__PURE__ */ jsxDEV("div", { className: "app", children: "Loading user\u2026" }, void 0, false, {
    fileName: "<stdin>",
    lineNumber: 144,
    columnNumber: 21
  }, this);
  return /* @__PURE__ */ jsxDEV("div", { className: "app", children: [
    /* @__PURE__ */ jsxDEV("div", { className: "header", children: [
      /* @__PURE__ */ jsxDEV("div", { children: [
        /* @__PURE__ */ jsxDEV("div", { className: "h1", children: "Ban That Image!" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 150,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "hint", children: "(Hint: Your banned images are stored as a single JSON row in the leaderboard.)" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 151,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 149,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "bar", children: [
        /* @__PURE__ */ jsxDEV("button", { className: "btn", onClick: () => setShowTutorial(true), children: "Open Tutorial" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 154,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "voice", children: [
          /* @__PURE__ */ jsxDEV("span", { className: "badge", children: "Voice" }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 156,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("select", { value: ttsVoice, onChange: (e) => setTtsVoice(e.target.value), children: [
            /* @__PURE__ */ jsxDEV("option", { value: "en-male", children: "EN Male" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 158,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("option", { value: "en-female", children: "EN Female" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 159,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("option", { value: "es-male", children: "ES Male" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 160,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("option", { value: "fr-female", children: "FR Female" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 161,
              columnNumber: 15
            }, this)
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 157,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("button", { className: "btn", onClick: playTutorial, disabled: playing, children: playing ? "Playing\u2026" : "Play" }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 163,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 155,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 153,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 148,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "section", children: /* @__PURE__ */ jsxDEV("div", { className: "toolbar", children: /* @__PURE__ */ jsxDEV("div", { className: "uploader", children: [
      /* @__PURE__ */ jsxDEV("label", { className: "btn", htmlFor: "fileUp", children: "Upload Image" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 171,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("input", { id: "fileUp", type: "file", accept: "image/*", onChange: (e) => handleUpload(e.target.files?.[0]) }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 172,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("span", { className: "rule", children: "Do NOT press this. Uploading adds YOUR image to the Gallery." }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 173,
        columnNumber: 13
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 170,
      columnNumber: 11
    }, this) }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 169,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 168,
      columnNumber: 7
    }, this),
    showTutorial && /* @__PURE__ */ jsxDEV("div", { className: "modal", onClick: () => setShowTutorial(false), children: /* @__PURE__ */ jsxDEV("div", { className: "sheet", onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ jsxDEV("div", { className: "tutor", children: [
        /* @__PURE__ */ jsxDEV("img", { className: "avatar", src: `https://images.websim.com/avatar/${user.username}`, alt: "you" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 182,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "col", children: [
          /* @__PURE__ */ jsxDEV("div", { className: "bubble", children: "Agent Ban reporting in. Ban Ban Ban! Earn Banjas by banning images that aren\u2019t yours. Try the tutorial image below for +1 Banja." }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 184,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "tiny", children: "Pro tip: Keep this tab open. I\u2019ll handle bans when you say the word." }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 187,
            columnNumber: 17
          }, this)
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 183,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV("button", { className: "btn", onClick: playTutorial, disabled: playing, children: playing ? "Playing\u2026" : "Hear Briefing" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 189,
          columnNumber: 15
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 181,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "section", children: /* @__PURE__ */ jsxDEV("div", { className: "grid", children: /* @__PURE__ */ jsxDEV("div", { className: "card", children: [
        /* @__PURE__ */ jsxDEV("img", { src: tImageUrl, alt: "tutorial" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 194,
          columnNumber: 19
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "meta", children: [
          /* @__PURE__ */ jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDEV("div", { children: /* @__PURE__ */ jsxDEV("strong", { children: "Tutorial Image" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 197,
              columnNumber: 28
            }, this) }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 197,
              columnNumber: 23
            }, this),
            /* @__PURE__ */ jsxDEV("small", { children: "Worth 1 Banja" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 198,
              columnNumber: 23
            }, this)
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 196,
            columnNumber: 21
          }, this),
          /* @__PURE__ */ jsxDEV("button", { className: "btn primary", onClick: () => banImage({ id: "tutorial" }, true), children: "Ban" }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 200,
            columnNumber: 21
          }, this)
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 195,
          columnNumber: 19
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 193,
        columnNumber: 17
      }, this) }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 192,
        columnNumber: 15
      }, this) }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 191,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", justifyContent: "flex-end", marginTop: 12 }, children: /* @__PURE__ */ jsxDEV("button", { className: "btn", onClick: () => setShowTutorial(false), children: "Close" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 206,
        columnNumber: 15
      }, this) }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 205,
        columnNumber: 13
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 180,
      columnNumber: 11
    }, this) }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 179,
      columnNumber: 9
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "section", children: [
      /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
        /* @__PURE__ */ jsxDEV("h2", { style: { margin: 0 }, children: "Gallery" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 214,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("span", { className: "badge", children: "Public" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 215,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 213,
        columnNumber: 9
      }, this),
      loadingImages ? /* @__PURE__ */ jsxDEV("div", { children: "Loading\u2026" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 217,
        columnNumber: 26
      }, this) : /* @__PURE__ */ jsxDEV("div", { className: "grid", children: gallery.map((img) => {
        const mine = img.user_id === user.id;
        return /* @__PURE__ */ jsxDEV("div", { className: "card", children: [
          /* @__PURE__ */ jsxDEV("img", { src: img.url, alt: "uploaded" }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 223,
            columnNumber: 19
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "meta", children: [
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV("div", { className: "bounty", children: [
                img.bounty,
                " Banja",
                img.bounty !== 1 ? "s" : ""
              ] }, void 0, true, {
                fileName: "<stdin>",
                lineNumber: 226,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("small", { children: mine ? "Your upload" : "Target" }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 227,
                columnNumber: 23
              }, this)
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 225,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", gap: 8 }, children: /* @__PURE__ */ jsxDEV("button", { className: "btn primary", disabled: mine, onClick: () => banImage(img), children: "Ban" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 230,
              columnNumber: 23
            }, this) }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 229,
              columnNumber: 21
            }, this)
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 224,
            columnNumber: 19
          }, this)
        ] }, img.id, true, {
          fileName: "<stdin>",
          lineNumber: 222,
          columnNumber: 17
        }, this);
      }) }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 218,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 212,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "section leaderboard", children: [
      /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
        /* @__PURE__ */ jsxDEV("h2", { style: { margin: 0 }, children: "Leaderboard" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 242,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("span", { className: "badge", children: "Realtime" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 243,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 241,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV(Leaderboard, {}, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 245,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 240,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV(Toast, { msg: toast.msg, show: toast.show }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 248,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV(Assistant, { voice: ttsVoice }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 249,
      columnNumber: 7
    }, this)
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 147,
    columnNumber: 5
  }, this);
}
function Toast({ msg, show }) {
  return /* @__PURE__ */ jsxDEV("div", { className: `toast ${show ? "show" : ""}`, children: msg }, void 0, false, {
    fileName: "<stdin>",
    lineNumber: 255,
    columnNumber: 10
  }, this);
}
function Leaderboard() {
  const { data: rows = [] } = useQuery(
    room.query(`select u.id, u.username, bs.score
      from public.${BANSTATE} bs
      join public.user u on (u.id = bs.id)
      order by bs.score desc nulls last`)
  );
  return /* @__PURE__ */ jsxDEV("div", { children: rows.map((row) => /* @__PURE__ */ jsxDEV("div", { className: "row", children: [
    /* @__PURE__ */ jsxDEV("img", { className: "avatar", src: `https://images.websim.com/avatar/${row.username}`, alt: "avatar" }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 269,
      columnNumber: 11
    }, this),
    /* @__PURE__ */ jsxDEV("strong", { children: [
      "@",
      row.username
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 270,
      columnNumber: 11
    }, this),
    /* @__PURE__ */ jsxDEV("span", { className: "score", children: [
      row.score || 0,
      " Banjas"
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 271,
      columnNumber: 11
    }, this)
  ] }, row.id, true, {
    fileName: "<stdin>",
    lineNumber: 268,
    columnNumber: 9
  }, this)) }, void 0, false, {
    fileName: "<stdin>",
    lineNumber: 266,
    columnNumber: 5
  }, this);
}
function Assistant({ voice }) {
  const [input, setInput] = useState("");
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);
  async function speak(text) {
    try {
      const res = await window.websim.textToSpeech({ text, voice });
      const audio = new Audio(res.url);
      audio.play();
    } catch {
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
      lineNumber: 316,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "chatlog", children: [
      log.map((m, i) => /* @__PURE__ */ jsxDEV("div", { className: `msg ${m.role === "user" ? "user" : "ai"}`, children: m.content }, i, false, {
        fileName: "<stdin>",
        lineNumber: 319,
        columnNumber: 11
      }, this)),
      log.length === 0 && /* @__PURE__ */ jsxDEV("div", { className: "msg ai", children: "Say \u201CStart banning\u201D and I\u2019ll guide you." }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 322,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 317,
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
          lineNumber: 326,
          columnNumber: 9
        },
        this
      ),
      /* @__PURE__ */ jsxDEV("button", { className: "btn", onClick: send, disabled: busy, children: busy ? "\u2026" : "Send" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 332,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 325,
      columnNumber: 7
    }, this)
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 315,
    columnNumber: 5
  }, this);
}
const root = createRoot(document.getElementById("root"));
root.render(/* @__PURE__ */ jsxDEV(App, {}, void 0, false, {
  fileName: "<stdin>",
  lineNumber: 339,
  columnNumber: 13
}));
