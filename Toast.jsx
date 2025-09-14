import { jsxDEV } from "react/jsx-dev-runtime";
import React from "react";
function Toast({ msg, show }) {
  return /* @__PURE__ */ jsxDEV("div", { className: `toast ${show ? "show" : ""}`, children: msg }, void 0, false, {
    fileName: "<stdin>",
    lineNumber: 4,
    columnNumber: 10
  }, this);
}
export {
  Toast
};
