// tide736.net の潮汐APIをサーバー側で中継する Netlify Function。
// ブラウザからは tide736 を直接呼べない(CORS非対応)が、サーバー間通信なら制限なし。
// 公開プロキシ依存をなくし、安定・高速に潮汐データを取得するための中継。
//
// 使い方: /api/tide?pc=13&hc=3&yr=2026&mn=6&dy=5
exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }

  const q = event.queryStringParameters || {};
  // 受け取れるパラメータだけを許可（安全のため固定）
  const pc = String(q.pc || "").replace(/[^0-9]/g, "");
  const hc = String(q.hc || "").replace(/[^0-9]/g, "");
  const yr = String(q.yr || "").replace(/[^0-9]/g, "");
  const mn = String(q.mn || "").replace(/[^0-9]/g, "");
  const dy = String(q.dy || "").replace(/[^0-9]/g, "");
  const rg = (q.rg === "month" || q.rg === "week") ? q.rg : "day";

  if (!pc || !hc || !yr || !mn || !dy) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "missing params (pc,hc,yr,mn,dy)" }) };
  }

  const target = `https://tide736.net/api/get_tide.php?pc=${pc}&hc=${hc}&yr=${yr}&mn=${mn}&dy=${dy}&rg=${rg}`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(target, { signal: ctrl.signal, headers: { "User-Agent": "fishing-log/1.0" } });
    clearTimeout(timer);
    const text = await res.text();
    return {
      statusCode: res.ok ? 200 : 502,
      headers: {
        ...cors,
        "Content-Type": "application/json; charset=utf-8",
        // 同じ日付・港のリクエストはCDN/ブラウザに1日キャッシュさせ、呼び出し回数を節約
        "Cache-Control": "public, max-age=86400",
      },
      body: text,
    };
  } catch (e) {
    return {
      statusCode: 504,
      headers: cors,
      body: JSON.stringify({ error: "tide736 fetch failed", detail: String(e && e.message || e) }),
    };
  }
};
