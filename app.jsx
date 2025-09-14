import { jsxDEV } from "react/jsx-dev-runtime";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { WebsimSocket, useQuery } from "@websim/use-query";
import { useCurrentUser, useCreator, useToast } from "./hooks.js";
import { GALLERY, BANSTATE, calcBounty, tutorialImage } from "./utils.js";
import { generateOrGetTTS } from "./tts.js";
import { TTS_VOICE } from "./utils.js";
import { Tutorial } from "./Tutorial.jsx";
import { Toast } from "./Toast.jsx";
import { Leaderboard } from "./Leaderboard.jsx";
import { Assistant } from "./Assistant.jsx";
import { Cover } from "./Cover.jsx";
const room = new WebsimSocket();
function App() {
  const [showCover, setShowCover] = useState(true);
  const user = useCurrentUser();
  const creator = useCreator();
  const { data: images = [], loading: loadingImages } = useQuery(room.collection(GALLERY));
  const { data: states = [], loading: loadingState } = useQuery(user ? room.collection(BANSTATE).filter({ id: user.id }) : null);
  const banState = states?.[0];
  const toast = useToast();
  const [tutorialStep, setTutorialStep] = useState(0);
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const lastAudioUrlRef = useRef(null);
  const lastPositionRef = useRef(0);
  const backgroundAudioRef = useRef(null);
  const fadeIntervalRef = useRef(null);
  const galleryRef = useRef(null);
  const uploadRef = useRef(null);
  const tutorialCardRef = useRef(null);
  const leaderboardRef = useRef(null);
  const assistantRef = useRef(null);
  function playBgMusic() {
    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    if (!backgroundAudioRef.current) {
      const audio2 = new Audio("tutorial_background.mp3");
      audio2.loop = true;
      backgroundAudioRef.current = audio2;
    }
    const audio = backgroundAudioRef.current;
    if (audio.paused) {
      audio.volume = 0;
      audio.play().catch((e) => console.error("Could not play bg music", e));
    }
    const maxVolume = 0.2;
    const fadeInDuration = 7e3;
    const fadeOutDuration = 7e3;
    const cycleDuration = fadeInDuration + fadeOutDuration;
    const stepTime = 50;
    let startTime = performance.now();
    fadeIntervalRef.current = setInterval(() => {
      const elapsedTime = (performance.now() - startTime) % cycleDuration;
      let targetVolume;
      if (elapsedTime < fadeInDuration) {
        targetVolume = elapsedTime / fadeInDuration * maxVolume;
      } else {
        const fadeOutElapsedTime = elapsedTime - fadeInDuration;
        targetVolume = maxVolume - fadeOutElapsedTime / fadeOutDuration * maxVolume;
      }
      audio.volume = Math.max(0, Math.min(maxVolume, targetVolume));
    }, stepTime);
  }
  function stopBgMusic() {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
    const audio = backgroundAudioRef.current;
    if (!audio || audio.paused) return;
    const startVolume = audio.volume;
    const fadeDuration = 1e3;
    const stepTime = 50;
    const volumeStep = startVolume / (fadeDuration / stepTime);
    const fadeOutInterval = setInterval(() => {
      const currentVolume = audio.volume;
      if (currentVolume > 0) {
        audio.volume = Math.max(0, currentVolume - volumeStep);
      } else {
        audio.pause();
        clearInterval(fadeOutInterval);
      }
    }, stepTime);
  }
  const handleEnter = () => {
    setShowCover(false);
    setTutorialStep(1);
    playBgMusic();
  };
  const handleRestartTutorial = () => {
    stopSound();
    setTutorialStep(1);
    playBgMusic();
  };
  useEffect(() => {
    if (tutorialStep === 0) {
      stopBgMusic();
    }
  }, [tutorialStep]);
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
  async function playSound(text, onEndCallback) {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.ontimeupdate = null;
      audioRef.current = null;
    }
    setPlaying(true);
    setPaused(false);
    try {
      const res = await generateOrGetTTS(text, TTS_VOICE, creator);
      lastAudioUrlRef.current = res.url;
      lastPositionRef.current = 0;
      const audio = new Audio(res.url);
      audioRef.current = audio;
      audio.ontimeupdate = () => {
        lastPositionRef.current = audio.currentTime || 0;
      };
      audio.onended = () => {
        setPlaying(false);
        setPaused(false);
        audioRef.current = null;
        if (onEndCallback) onEndCallback();
      };
      await audio.play();
    } catch (e) {
      console.error("TTS failed", e);
      setPlaying(false);
    }
  }
  function stopSound() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.ontimeupdate = null;
      audioRef.current = null;
    }
    setPlaying(false);
    setPaused(false);
  }
  function pauseSound() {
    if (audioRef.current && playing && !paused) {
      lastPositionRef.current = audioRef.current.currentTime || 0;
      audioRef.current.pause();
      setPaused(true);
    }
  }
  function resumeSound() {
    if (audioRef.current && playing && paused) {
      audioRef.current.play();
      setPaused(false);
      return;
    }
    const url = lastAudioUrlRef.current;
    const t = lastPositionRef.current || 0;
    if (!url) return;
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlaying(true);
    setPaused(false);
    audio.ontimeupdate = () => {
      lastPositionRef.current = audio.currentTime || 0;
    };
    audio.onended = () => {
      setPlaying(false);
      setPaused(false);
      audioRef.current = null;
    };
    const startAt = Math.max(0, t - 0.05);
    const startPlayback = () => {
      try {
        audio.currentTime = startAt;
      } catch (_) {
      }
      audio.play();
    };
    if (audio.readyState >= 1) startPlayback();
    else audio.addEventListener("loadedmetadata", startPlayback, { once: true });
  }
  if (showCover) {
    return /* @__PURE__ */ jsxDEV(Cover, { onEnter: handleEnter }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 270,
      columnNumber: 12
    }, this);
  }
  if (!user) return /* @__PURE__ */ jsxDEV("div", { className: "app", children: "Loading user\u2026" }, void 0, false, {
    fileName: "<stdin>",
    lineNumber: 273,
    columnNumber: 21
  }, this);
  return /* @__PURE__ */ jsxDEV("div", { className: "app", children: [
    tutorialStep > 0 && /* @__PURE__ */ jsxDEV(
      Tutorial,
      {
        step: tutorialStep,
        setStep: setTutorialStep,
        playSound,
        pauseSound,
        resumeSound,
        stopSound,
        playing,
        creator,
        refs: { galleryRef, uploadRef, tutorialCardRef, leaderboardRef, assistantRef }
      },
      void 0,
      false,
      {
        fileName: "<stdin>",
        lineNumber: 278,
        columnNumber: 9
      },
      this
    ),
    /* @__PURE__ */ jsxDEV("div", { className: "header", children: [
      /* @__PURE__ */ jsxDEV("div", { children: [
        /* @__PURE__ */ jsxDEV("div", { className: "h1", children: "Ban That Image!" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 292,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "hint", children: "(Hint: Your banned images are stored as a single JSON row in the leaderboard.)" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 293,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 291,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "bar", children: /* @__PURE__ */ jsxDEV("button", { className: "btn", onClick: handleRestartTutorial, children: "Restart Tutorial" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 296,
        columnNumber: 11
      }, this) }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 295,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 290,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "section", children: /* @__PURE__ */ jsxDEV("div", { className: "toolbar", children: /* @__PURE__ */ jsxDEV("div", { className: "uploader", ref: uploadRef, children: [
      /* @__PURE__ */ jsxDEV("label", { className: "btn btn-upload", htmlFor: "fileUp", children: "Upload Image" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 303,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("input", { id: "fileUp", type: "file", accept: "image/*", onChange: (e) => handleUpload(e.target.files?.[0]) }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 304,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("span", { className: "rule", children: "Do NOT press this. Uploading adds YOUR image to the Gallery." }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 305,
        columnNumber: 13
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 302,
      columnNumber: 11
    }, this) }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 301,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 300,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "section", ref: galleryRef, children: [
      /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
        /* @__PURE__ */ jsxDEV("h2", { style: { margin: 0 }, children: "Gallery" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 312,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("span", { className: "badge", children: "Public" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 313,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 311,
        columnNumber: 9
      }, this),
      loadingImages ? /* @__PURE__ */ jsxDEV("div", { children: "Loading\u2026" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 315,
        columnNumber: 26
      }, this) : /* @__PURE__ */ jsxDEV("div", { className: "grid", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "card", ref: tutorialCardRef, children: [
          /* @__PURE__ */ jsxDEV("img", { src: tutorialImage.url, alt: "tutorial" }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 318,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "meta", children: [
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV("div", { children: /* @__PURE__ */ jsxDEV("strong", { children: "Tutorial Image" }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 321,
                columnNumber: 26
              }, this) }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 321,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV("small", { children: "Worth 1 Banja" }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 322,
                columnNumber: 21
              }, this)
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 320,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("button", { className: "btn primary", onClick: () => banImage({ id: "tutorial" }, true), children: "Ban" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 324,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 319,
            columnNumber: 17
          }, this)
        ] }, "tutorial-card", true, {
          fileName: "<stdin>",
          lineNumber: 317,
          columnNumber: 13
        }, this),
        gallery.map((img) => {
          const mine = img.user_id === user.id;
          return /* @__PURE__ */ jsxDEV("div", { className: "card", children: [
            /* @__PURE__ */ jsxDEV("img", { src: img.url, alt: "uploaded" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 331,
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
                  lineNumber: 334,
                  columnNumber: 23
                }, this),
                /* @__PURE__ */ jsxDEV("small", { children: mine ? "Your upload" : "Target" }, void 0, false, {
                  fileName: "<stdin>",
                  lineNumber: 335,
                  columnNumber: 23
                }, this)
              ] }, void 0, true, {
                fileName: "<stdin>",
                lineNumber: 333,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", gap: 8 }, children: /* @__PURE__ */ jsxDEV("button", { className: "btn primary", disabled: mine, onClick: () => banImage(img), children: "Ban" }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 338,
                columnNumber: 23
              }, this) }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 337,
                columnNumber: 21
              }, this)
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 332,
              columnNumber: 19
            }, this)
          ] }, img.id, true, {
            fileName: "<stdin>",
            lineNumber: 330,
            columnNumber: 17
          }, this);
        })
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 316,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 310,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "section leaderboard", ref: leaderboardRef, children: [
      /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
        /* @__PURE__ */ jsxDEV("h2", { style: { margin: 0 }, children: "Leaderboard" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 350,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("span", { className: "badge", children: "Realtime" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 351,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 349,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV(Leaderboard, {}, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 353,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 348,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV(Toast, { msg: toast.msg, show: toast.show }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 356,
      columnNumber: 7
    }, this),
    (tutorialStep === 0 || tutorialStep > 5) && /* @__PURE__ */ jsxDEV("div", { ref: assistantRef, children: /* @__PURE__ */ jsxDEV(Assistant, {}, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 357,
      columnNumber: 76
    }, this) }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 357,
      columnNumber: 52
    }, this)
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 276,
    columnNumber: 5
  }, this);
}
const root = createRoot(document.getElementById("root"));
root.render(/* @__PURE__ */ jsxDEV(App, {}, void 0, false, {
  fileName: "<stdin>",
  lineNumber: 363,
  columnNumber: 13
}));
