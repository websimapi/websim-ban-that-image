import { Fragment, jsxDEV } from "react/jsx-dev-runtime";
import React, { useEffect, useRef, useState } from "react";
import { generateOrGetTTS } from "./tts.js";
import { TTS_VOICE } from "./utils.js";
const TUTORIAL_CONTENT = [
  null,
  { text: "Psst. Hey. Yeah, you. Welcome to the agency. I'm Agent Ban. Our mission: find any image in this gallery and BAN IT!", target: null, placement: "center" },
  { text: "This is the Gallery. The enemy's stronghold. Each image here is a target, waiting to be... neutralized. Observe and report.", target: "galleryRef", placement: "bottom" },
  { text: "Now THIS... this is the big red button of temptation. Pressing it unleashes YOUR image into the gallery. We're trying to clear images, not add more! So... don't... press... it. (Unless you want to, I'm not your boss... but I am.)", target: "uploadRef", placement: "bottom" },
  { text: "Alright, your first mission. A gimme. This 'Tutorial Image' is a freebie. Ban it to earn your first Banja and prove you're not a rookie. Go on, click that beautiful 'Ban' button.", target: "tutorialCardRef", placement: "bottom" },
  { text: "MISSION ACCOMPLISHED! See that? You're on the board! The Leaderboard shows the top agents. Keep banning to climb the ranks.", target: "leaderboardRef", placement: "top" },
  { text: "One last thing. If you need me, I'm always on comms. Right here in the bottom right. Ask me anything, or tell me to 'start banning'. I'm good like that.", target: "assistantRef", placement: "top-right" },
  { text: "That's it, you're a fully-fledged agent now. Go make the agency proud. Dismissed!", target: null, placement: "center" }
];
const TROLL_TEXTS = [
  "Whoa, whoa, whoa there, speedy. This part is important, you really need to listen! Now, where was I...",
  "Woah. Seriously\u2014this bit is crucial. If you skip it, you'll miss the one trick that separates agents from amateurs. Deep breath. Focus. Now, where was I...",
  "WOAH. Agent, stand down on that Next button. This briefing keeps the agency from imploding, kittens from crying, and your Banjas from evaporating. Three more seconds of patience. Now... where was I..."
];
function Tutorial({ step, setStep, refs, playSound, pauseSound, resumeSound, stopSound, playing, creator }) {
  const [highlightStyle, setHighlightStyle] = useState({ opacity: 0 });
  const [popoverStyle, setPopoverStyle] = useState({ opacity: 0 });
  const popoverRef = useRef(null);
  const content = TUTORIAL_CONTENT[step];
  const trollCountsRef = useRef({});
  const [isTrolling, setIsTrolling] = useState(false);
  useEffect(() => {
    const stepContent = TUTORIAL_CONTENT[step];
    if (!stepContent) {
      stopSound();
      return;
    }
    playSound(stepContent.text);
    return () => {
      stopSound();
    };
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
  const handleNext = async () => {
    if (isTrolling) return;
    if (playing) {
      const prev = trollCountsRef.current[step] || 0;
      const count = prev + 1;
      trollCountsRef.current[step] = count;
      setIsTrolling(true);
      pauseSound();
      try {
        const text = TROLL_TEXTS[Math.min(count - 1, TROLL_TEXTS.length - 1)];
        const res = await generateOrGetTTS(text, TTS_VOICE, creator);
        const trollAudio = new Audio(res.url);
        await new Promise((resolve) => {
          trollAudio.onended = resolve;
          trollAudio.play();
        });
      } catch (e) {
        console.error("Troll TTS failed", e);
      }
      resumeSound();
      setIsTrolling(false);
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
      lineNumber: 141,
      columnNumber: 11
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "tutorial-popover", ref: popoverRef, style: popoverStyle, children: [
      /* @__PURE__ */ jsxDEV("p", { children: content.text }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 143,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "tutorial-nav", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "tutorial-dots", children: TUTORIAL_CONTENT.slice(1).map((_, i) => /* @__PURE__ */ jsxDEV("span", { className: i + 1 === step ? "active" : "" }, i, false, {
          fileName: "<stdin>",
          lineNumber: 146,
          columnNumber: 62
        }, this)) }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 145,
          columnNumber: 17
        }, this),
        !isWaitingStep && /* @__PURE__ */ jsxDEV("button", { className: "btn primary", onClick: handleNext, disabled: isTrolling, children: isLastStep ? "Finish" : "Next" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 149,
          columnNumber: 21
        }, this),
        isWaitingStep && /* @__PURE__ */ jsxDEV("button", { className: "btn", disabled: true, children: "Waiting..." }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 151,
          columnNumber: 35
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 144,
        columnNumber: 13
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 142,
      columnNumber: 11
    }, this)
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 140,
    columnNumber: 9
  }, this);
}
export {
  Tutorial
};
