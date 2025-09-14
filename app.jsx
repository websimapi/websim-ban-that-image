import { Fragment, jsxDEV } from "react/jsx-dev-runtime";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { WebsimSocket, useQuery } from "@websim/use-query";
const room = new WebsimSocket();
const GALLERY = "gallery_image";
const BANSTATE = "ban_state";
const CREATOR_META = "creator_metadata";
const TTS_VOICE = "en-male";
function useCurrentUser() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    (async () => setUser(await window.websim.getCurrentUser()))();
  }, []);
  return user;
}
function useCreator() {
  const [creator, setCreator] = useState(null);
  useEffect(() => {
    (async () => setCreator(await window.websim.getCreator()))();
  }, []);
  return creator;
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
async function ensureCreatorMetadata(creator) {
  if (!creator) return null;
  const existing = await room.collection(CREATOR_META).filter({ id: creator.id }).getList();
  if (existing.length === 0) {
    await room.collection(CREATOR_META).upsert({
      id: creator.id,
      tts_cache: {}
    });
    return { id: creator.id, tts_cache: {} };
  }
  return existing[0];
}
async function getCachedTTS(text, voice, creator) {
  if (!creator) return null;
  const metadata = await ensureCreatorMetadata(creator);
  if (!metadata) return null;
  const textId = `${text}_${voice}`;
  const ttsCache = metadata.tts_cache || {};
  return ttsCache[textId] || null;
}
async function cacheTTS(text, voice, audioUrl, creator) {
  if (!creator) return;
  const textId = `${text}_${voice}`;
  const metadata = await ensureCreatorMetadata(creator);
  const currentCache = metadata?.tts_cache || {};
  const updatedCache = { ...currentCache, [textId]: audioUrl };
  await room.collection(CREATOR_META).upsert({
    id: creator.id,
    tts_cache: updatedCache
  });
}
async function generateOrGetTTS(text, voice, creator) {
  const cached = await getCachedTTS(text, voice, creator);
  if (cached) {
    console.log("Using cached TTS for:", text.substring(0, 50) + "...");
    return { url: cached };
  }
  console.log("Generating new TTS for:", text.substring(0, 50) + "...");
  const res = await window.websim.textToSpeech({ text, voice });
  await cacheTTS(text, voice, res.url, creator);
  return res;
}
const tutorialImage = {
  id: "tutorial",
  url: "tutorial_image.png",
  title: "Tutorial Image",
  created_at: new Date(Date.now() - 36e5).toISOString(),
  // 1 hour ago => 1 Banja
  owner_id: "system"
};
function App() {
  const user = useCurrentUser();
  const creator = useCreator();
  const { data: images = [], loading: loadingImages } = useQuery(room.collection(GALLERY));
  const { data: states = [], loading: loadingState } = useQuery(user ? room.collection(BANSTATE).filter({ id: user.id }) : null);
  const banState = states?.[0];
  const toast = useToast();
  const [tutorialStep, setTutorialStep] = useState(1);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);
  const playQueueRef = useRef([]);
  const currentAudioInfoRef = useRef({ text: null, time: 0 });
  const galleryRef = useRef(null);
  const uploadRef = useRef(null);
  const tutorialCardRef = useRef(null);
  const leaderboardRef = useRef(null);
  const assistantRef = useRef(null);
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
    const url = isTutorial ? tutorialImage.url : img.url;
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
    if (isTutorial) {
      setTutorialStep(5);
    }
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
  async function playNextInQueue() {
    if (playQueueRef.current.length > 0) {
      const { text, resumeTime } = playQueueRef.current.shift();
      await playSound(text, resumeTime);
    }
  }
  async function playSound(text, resumeTime = 0) {
    if (!creator || playing) return;
    setPlaying(true);
    currentAudioInfoRef.current.text = text;
    try {
      const res = await generateOrGetTTS(text, TTS_VOICE, creator);
      const audio = new Audio(res.url);
      audioRef.current = audio;
      audio.currentTime = resumeTime;
      const playPromise = new Promise((resolve, reject) => {
        audio.onended = resolve;
        audio.onerror = reject;
        audio.play().catch(reject);
      });
      await playPromise;
    } catch (e) {
      console.error("TTS failed", e);
    } finally {
      setPlaying(false);
      audioRef.current = null;
      currentAudioInfoRef.current = { text: null, time: 0 };
      playNextInQueue();
    }
  }
  const handleTutorialSkip = async () => {
    if (playing && audioRef.current) {
      const currentTime = audioRef.current.currentTime;
      const originalText = currentAudioInfoRef.current.text;
      audioRef.current.pause();
      setPlaying(false);
      playQueueRef.current = [
        { text: "Whoa, whoa, whoa there... you REALLY need to listen to this part!", resumeTime: 0 },
        { text: "Now, where was I...", resumeTime: 0 },
        { text: originalText, resumeTime: currentTime }
      ];
      await playNextInQueue();
    }
  };
  if (!user) return /* @__PURE__ */ jsxDEV("div", { className: "app", children: "Loading user\u2026" }, void 0, false, {
    fileName: "<stdin>",
    lineNumber: 253,
    columnNumber: 21
  }, this);
  return /* @__PURE__ */ jsxDEV("div", { className: "app", children: [
    tutorialStep > 0 && /* @__PURE__ */ jsxDEV(
      Tutorial,
      {
        step: tutorialStep,
        setStep: setTutorialStep,
        playSound,
        isPlaying: playing,
        onSkip: handleTutorialSkip,
        refs: { galleryRef, uploadRef, tutorialCardRef, leaderboardRef, assistantRef }
      },
      void 0,
      false,
      {
        fileName: "<stdin>",
        lineNumber: 258,
        columnNumber: 9
      },
      this
    ),
    /* @__PURE__ */ jsxDEV("div", { className: "header", children: [
      /* @__PURE__ */ jsxDEV("div", { children: [
        /* @__PURE__ */ jsxDEV("div", { className: "h1", children: "Ban That Image!" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 269,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "hint", children: "(Hint: Your banned images are stored as a single JSON row in the leaderboard.)" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 270,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 268,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "bar", children: /* @__PURE__ */ jsxDEV("button", { className: "btn", onClick: () => {
        if (audioRef.current) audioRef.current.pause();
        setPlaying(false);
        playQueueRef.current = [];
        setTutorialStep(1);
      }, children: "Restart Tutorial" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 273,
        columnNumber: 11
      }, this) }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 272,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 267,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "section", children: /* @__PURE__ */ jsxDEV("div", { className: "toolbar", children: /* @__PURE__ */ jsxDEV("div", { className: "uploader", ref: uploadRef, children: [
      /* @__PURE__ */ jsxDEV("label", { className: "btn btn-upload", htmlFor: "fileUp", children: "Upload Image" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 285,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("input", { id: "fileUp", type: "file", accept: "image/*", onChange: (e) => handleUpload(e.target.files?.[0]) }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 286,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("span", { className: "rule", children: "Do NOT press this. Uploading adds YOUR image to the Gallery." }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 287,
        columnNumber: 13
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 284,
      columnNumber: 11
    }, this) }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 283,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 282,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "section", ref: galleryRef, children: [
      /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
        /* @__PURE__ */ jsxDEV("h2", { style: { margin: 0 }, children: "Gallery" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 294,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("span", { className: "badge", children: "Public" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 295,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 293,
        columnNumber: 9
      }, this),
      loadingImages ? /* @__PURE__ */ jsxDEV("div", { children: "Loading\u2026" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 297,
        columnNumber: 26
      }, this) : /* @__PURE__ */ jsxDEV("div", { className: "grid", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "card", ref: tutorialCardRef, children: [
          /* @__PURE__ */ jsxDEV("img", { src: tutorialImage.url, alt: "tutorial" }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 300,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "meta", children: [
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV("div", { children: /* @__PURE__ */ jsxDEV("strong", { children: "Tutorial Image" }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 303,
                columnNumber: 26
              }, this) }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 303,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV("small", { children: "Worth 1 Banja" }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 304,
                columnNumber: 21
              }, this)
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 302,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("button", { className: "btn primary", onClick: () => banImage({ id: "tutorial" }, true), children: "Ban" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 306,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 301,
            columnNumber: 17
          }, this)
        ] }, "tutorial-card", true, {
          fileName: "<stdin>",
          lineNumber: 299,
          columnNumber: 13
        }, this),
        gallery.map((img) => {
          const mine = img.user_id === user.id;
          return /* @__PURE__ */ jsxDEV("div", { className: "card", children: [
            /* @__PURE__ */ jsxDEV("img", { src: img.url, alt: "uploaded" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 313,
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
                  lineNumber: 316,
                  columnNumber: 23
                }, this),
                /* @__PURE__ */ jsxDEV("small", { children: mine ? "Your upload" : "Target" }, void 0, false, {
                  fileName: "<stdin>",
                  lineNumber: 317,
                  columnNumber: 23
                }, this)
              ] }, void 0, true, {
                fileName: "<stdin>",
                lineNumber: 315,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", gap: 8 }, children: /* @__PURE__ */ jsxDEV("button", { className: "btn primary", disabled: mine, onClick: () => banImage(img), children: "Ban" }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 320,
                columnNumber: 23
              }, this) }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 319,
                columnNumber: 21
              }, this)
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 314,
              columnNumber: 19
            }, this)
          ] }, img.id, true, {
            fileName: "<stdin>",
            lineNumber: 312,
            columnNumber: 17
          }, this);
        })
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 298,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 292,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "section leaderboard", ref: leaderboardRef, children: [
      /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
        /* @__PURE__ */ jsxDEV("h2", { style: { margin: 0 }, children: "Leaderboard" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 332,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("span", { className: "badge", children: "Realtime" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 333,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 331,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV(Leaderboard, {}, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 335,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 330,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV(Toast, { msg: toast.msg, show: toast.show }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 338,
      columnNumber: 7
    }, this),
    (tutorialStep === 0 || tutorialStep > 5) && /* @__PURE__ */ jsxDEV("div", { ref: assistantRef, children: /* @__PURE__ */ jsxDEV(Assistant, {}, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 339,
      columnNumber: 76
    }, this) }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 339,
      columnNumber: 52
    }, this)
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 256,
    columnNumber: 5
  }, this);
}
const TUTORIAL_CONTENT = [
  null,
  // step 0 is off
  { text: "Psst. Hey. Yeah, you. Welcome to the agency. I'm Agent Ban. Our mission: find any image in this gallery and BAN IT!", target: null, placement: "center" },
  { text: "This is the Gallery. The enemy's stronghold. Each image here is a target, waiting to be... neutralized. Observe and report.", target: "galleryRef", placement: "bottom" },
  { text: "Now THIS... this is the big red button of temptation. Pressing it unleashes YOUR image into the gallery. We're trying to clear images, not add more! So... don't... press... it. (Unless you want to, I'm not your boss... but I am.)", target: "uploadRef", placement: "bottom" },
  { text: "Alright, your first mission. A gimme. This 'Tutorial Image' is a freebie. Ban it to earn your first Banja and prove you're not a rookie. Go on, click that beautiful 'Ban' button.", target: "tutorialCardRef", placement: "bottom" },
  { text: "MISSION ACCOMPLISHED! See that? You're on the board! The Leaderboard shows the top agents. Keep banning to climb the ranks.", target: "leaderboardRef", placement: "top" },
  { text: "One last thing. If you need me, I'm always on comms. Right here in the bottom right. Ask me anything, or tell me to 'start banning'. I'm good like that.", target: "assistantRef", placement: "top-right" }
];
function Tutorial({ step, setStep, refs, playSound, isPlaying, onSkip }) {
  const [highlightStyle, setHighlightStyle] = useState({ opacity: 0 });
  const [popoverStyle, setPopoverStyle] = useState({ opacity: 0 });
  const popoverRef = useRef(null);
  const content = TUTORIAL_CONTENT[step];
  const [hasSkipped, setHasSkipped] = useState(false);
  useEffect(() => {
    if (!content) return;
    setHasSkipped(false);
    playSound(content.text);
  }, [step]);
  useEffect(() => {
    if (!content) {
      setHighlightStyle({ opacity: 0, pointerEvents: "none" });
      setPopoverStyle({ opacity: 0, pointerEvents: "none" });
      return;
    }
    if (content.target && refs[content.target]?.current) {
      const targetEl = refs[content.target].current;
      const rect = targetEl.getBoundingClientRect();
      setHighlightStyle({
        width: `${rect.width + 12}px`,
        height: `${rect.height + 12}px`,
        top: `${rect.top - 6}px`,
        left: `${rect.left - 6}px`
      });
      if (popoverRef.current) {
        const popRect = popoverRef.current.getBoundingClientRect();
        let popTop, popLeft;
        switch (content.placement) {
          case "bottom":
            popTop = rect.bottom + 15;
            popLeft = rect.left + rect.width / 2 - popRect.width / 2;
            break;
          case "top":
            popTop = rect.top - popRect.height - 15;
            popLeft = rect.left + rect.width / 2 - popRect.width / 2;
            break;
          case "top-right":
            popTop = rect.top - popRect.height - 15;
            popLeft = rect.right - popRect.width;
            break;
          default:
            popTop = rect.bottom + 15;
            popLeft = rect.left + rect.width / 2 - popRect.width / 2;
        }
        popTop = Math.max(8, Math.min(popTop, window.innerHeight - popRect.height - 8));
        popLeft = Math.max(8, Math.min(popLeft, window.innerWidth - popRect.width - 8));
        setPopoverStyle({ top: `${popTop}px`, left: `${popLeft}px`, opacity: 1 });
      }
    } else if (content.placement === "center") {
      setHighlightStyle({ opacity: 0 });
      if (popoverRef.current) {
        const popRect = popoverRef.current.getBoundingClientRect();
        setPopoverStyle({
          top: `50%`,
          left: `50%`,
          transform: `translate(-50%, -50%)`,
          opacity: 1
        });
      }
    }
  }, [step, content, refs]);
  const isLastStep = step === TUTORIAL_CONTENT.length - 1;
  const isWaitingStep = step === 4;
  const handleNext = () => {
    if (isPlaying) {
      onSkip();
      setHasSkipped(true);
      return;
    }
    if (isLastStep) {
      setStep(0);
    } else {
      setStep((s) => s + 1);
    }
  };
  if (!content) return null;
  return /* @__PURE__ */ jsxDEV(Fragment, { children: [
    /* @__PURE__ */ jsxDEV("div", { className: "tutorial-highlight", style: highlightStyle }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 448,
      columnNumber: 11
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "tutorial-popover", ref: popoverRef, style: popoverStyle, children: [
      /* @__PURE__ */ jsxDEV("p", { children: content.text }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 450,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "tutorial-nav", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "tutorial-dots", children: TUTORIAL_CONTENT.slice(1).map((_, i) => /* @__PURE__ */ jsxDEV("span", { className: i + 1 === step ? "active" : "" }, i, false, {
          fileName: "<stdin>",
          lineNumber: 453,
          columnNumber: 62
        }, this)) }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 452,
          columnNumber: 17
        }, this),
        !isWaitingStep && /* @__PURE__ */ jsxDEV("button", { className: "btn primary", onClick: handleNext, disabled: hasSkipped && isPlaying, children: hasSkipped && isPlaying ? "Listen up!" : isLastStep ? "Finish" : "Next" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 456,
          columnNumber: 21
        }, this),
        isWaitingStep && /* @__PURE__ */ jsxDEV("button", { className: "btn", disabled: true, children: "Waiting..." }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 460,
          columnNumber: 35
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 451,
        columnNumber: 13
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 449,
      columnNumber: 11
    }, this)
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 447,
    columnNumber: 9
  }, this);
}
function Toast({ msg, show }) {
  return /* @__PURE__ */ jsxDEV("div", { className: `toast ${show ? "show" : ""}`, children: msg }, void 0, false, {
    fileName: "<stdin>",
    lineNumber: 468,
    columnNumber: 10
  }, this);
}
function Leaderboard() {
  const { data: rows = [] } = useQuery(
    room.query(`select u.id, u.username, bs.score
      from public.${BANSTATE} bs
      join public.user u on (u.id = (bs.id)::uuid)
      order by bs.score desc nulls last`)
  );
  return /* @__PURE__ */ jsxDEV("div", { children: rows.map((row) => /* @__PURE__ */ jsxDEV("div", { className: "row", children: [
    /* @__PURE__ */ jsxDEV("img", { className: "avatar", src: `https://images.websim.com/avatar/${row.username}`, alt: "avatar" }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 482,
      columnNumber: 11
    }, this),
    /* @__PURE__ */ jsxDEV("strong", { children: [
      "@",
      row.username
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 483,
      columnNumber: 11
    }, this),
    /* @__PURE__ */ jsxDEV("span", { className: "score", children: [
      row.score || 0,
      " Banjas"
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 484,
      columnNumber: 11
    }, this)
  ] }, row.id, true, {
    fileName: "<stdin>",
    lineNumber: 481,
    columnNumber: 9
  }, this)) }, void 0, false, {
    fileName: "<stdin>",
    lineNumber: 479,
    columnNumber: 5
  }, this);
}
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
      lineNumber: 533,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "chatlog", children: [
      log.map((m, i) => /* @__PURE__ */ jsxDEV("div", { className: `msg ${m.role === "user" ? "user" : "ai"}`, children: m.content }, i, false, {
        fileName: "<stdin>",
        lineNumber: 536,
        columnNumber: 11
      }, this)),
      log.length === 0 && /* @__PURE__ */ jsxDEV("div", { className: "msg ai", children: `Say "Start banning" and I'll guide you.` }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 539,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 534,
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
          lineNumber: 543,
          columnNumber: 9
        },
        this
      ),
      /* @__PURE__ */ jsxDEV("button", { className: "btn", onClick: send, disabled: busy, children: busy ? "\u2026" : "Send" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 549,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 542,
      columnNumber: 7
    }, this)
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 532,
    columnNumber: 5
  }, this);
}
const root = createRoot(document.getElementById("root"));
root.render(/* @__PURE__ */ jsxDEV(App, {}, void 0, false, {
  fileName: "<stdin>",
  lineNumber: 556,
  columnNumber: 13
}));
