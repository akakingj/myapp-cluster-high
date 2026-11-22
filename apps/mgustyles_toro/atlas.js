/* MGU Styles 0.9.1 - (c) 2026 its author. Not open source: see LICENSE. */
"use strict";var zlib=require("zlib"),data=require("./atlas_data.js");function load(){return{meta:data.meta,pixels:zlib.gunzipSync(Buffer.from(data.r8gz,"base64"))}}module.exports={load};
