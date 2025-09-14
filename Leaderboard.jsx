import { jsxDEV } from "react/jsx-dev-runtime";
import React from "react";
import { WebsimSocket, useQuery } from "@websim/use-query";
import { BANSTATE } from "./utils.js";
const room = new WebsimSocket();
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
      lineNumber: 18,
      columnNumber: 11
    }, this),
    /* @__PURE__ */ jsxDEV("strong", { children: [
      "@",
      row.username
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 19,
      columnNumber: 11
    }, this),
    /* @__PURE__ */ jsxDEV("span", { className: "score", children: [
      row.score || 0,
      " Banjas"
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 20,
      columnNumber: 11
    }, this)
  ] }, row.id, true, {
    fileName: "<stdin>",
    lineNumber: 17,
    columnNumber: 9
  }, this)) }, void 0, false, {
    fileName: "<stdin>",
    lineNumber: 15,
    columnNumber: 5
  }, this);
}
export {
  Leaderboard
};
