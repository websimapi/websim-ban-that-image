import { jsxDEV } from "react/jsx-dev-runtime";
import React, { useState } from "react";
function Cover({ show, onEnter }) {
  const [isExiting, setIsExiting] = useState(false);
  const handleClick = () => {
    if (isExiting) return;
    setIsExiting(true);
  };
  const handleAnimationEnd = (e) => {
    if (e.target.classList.contains("cover-overlay")) {
      onEnter();
    }
  };
  if (!show) return null;
  return /* @__PURE__ */ jsxDEV(
    "div",
    {
      className: `cover-overlay ${isExiting ? "exiting" : ""}`,
      onClick: handleClick,
      onTransitionEnd: handleAnimationEnd,
      children: [
        /* @__PURE__ */ jsxDEV("div", { className: "cover-content", children: [
          /* @__PURE__ */ jsxDEV("img", { src: "agent_ban_badge.png", className: "cover-badge", alt: "Agent Ban Badge" }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 27,
            columnNumber: 9
          }, this),
          /* @__PURE__ */ jsxDEV("img", { src: "top_secret_folder.png", className: "cover-folder", alt: "Top Secret Folder" }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 28,
            columnNumber: 9
          }, this)
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 26,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "cover-text", children: "Click to Enter" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 30,
          columnNumber: 7
        }, this)
      ]
    },
    void 0,
    true,
    {
      fileName: "<stdin>",
      lineNumber: 21,
      columnNumber: 5
    },
    this
  );
}
export {
  Cover
};
