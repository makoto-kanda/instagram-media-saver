"use strict";

const urlInput = document.getElementById("urlInput");
const checkButton = document.getElementById("checkButton");
const clearButton = document.getElementById("clearButton");

const resultPanel = document.getElementById("resultPanel");
const postType = document.getElementById("postType");
const instagramLink = document.getElementById("instagramLink");

const firefoxAction = document.getElementById("firefoxAction");
const firefoxButton = document.getElementById("firefoxButton");

const testPanel = document.getElementById("testPanel");
const resultA = document.getElementById("resultA");
const resultB = document.getElementById("resultB");

const summaryPanel = document.getElementById("summaryPanel");
const summary = document.getElementById("summary");

const swStatus = document.getElementById("swStatus");

let currentTestUrl = null;


// --------------------------------------------------
// Instagram URLを抽出
// --------------------------------------------------

function extractInstagramUrl(text) {
    if (!text) {
        return null;
    }

    const regex =
        /https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\/[^\s"'<>]+/gi;

    const matches = text.match(regex);

    if (!matches) {
        return null;
    }

    for (const candidate of matches) {
        const cleaned = candidate.replace(/[.,;!?)}\]]+$/, "");

        try {
            const parsed = new URL(cleaned);

            const allowedHosts = [
                "instagram.com",
                "www.instagram.com",
                "instagr.am"
            ];

            if (!allowedHosts.includes(parsed.hostname.toLowerCase())) {
                continue;
            }

            return parsed.href;

        } catch {
            continue;
        }
    }

    return null;
}


// --------------------------------------------------
// URLの検証
// --------------------------------------------------

function validateInstagramUrl(value) {
    try {
        const url = new URL(value);

        const allowedHosts = [
            "instagram.com",
            "www.instagram.com",
            "instagr.am"
        ];

        if (!allowedHosts.includes(url.hostname.toLowerCase())) {
            return null;
        }

        if (
            !/^\/(p|reel|reels|tv)\//i.test(url.pathname)
        ) {
            return null;
        }

        return url.href;

    } catch {
        return null;
    }
}


// --------------------------------------------------
// 投稿タイプ判定
// --------------------------------------------------

function detectPostType(url) {
    try {
        const pathname = new URL(url).pathname;

        if (/^\/p\//i.test(pathname)) {
            return "通常の投稿";
        }

        if (/^\/reel(s)?\//i.test(pathname)) {
            return "リール";
        }

        if (/^\/tv\//i.test(pathname)) {
            return "IGTV";
        }

        return "その他";

    } catch {
        return "不明";
    }
}


// --------------------------------------------------
// 投稿URLの表示
// --------------------------------------------------

function displayPostInfo(url) {
    postType.textContent = detectPostType(url);

    instagramLink.textContent = url;
    instagramLink.href = url;

    resultPanel.classList.remove("hidden");
    firefoxAction.classList.remove("hidden");
}








// --------------------------------------------------
// FirefoxでInstagram投稿を開く
// --------------------------------------------------

function openInFirefox(url) {
    const validUrl = validateInstagramUrl(url);

    if (!validUrl) {
        alert("有効なInstagram投稿URLがありません。");
        return;
    }

    // Android以外では通常のリンクとして開く
    if (!/Android/i.test(navigator.userAgent)) {
        window.open(validUrl, "_blank", "noopener");
        return;
    }

    const parsed = new URL(validUrl);

    const intentUrl =
        `intent://${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}` +
        `#Intent;` +
        `scheme=https;` +
        `package=org.mozilla.firefox;` +
        `S.browser_fallback_url=${encodeURIComponent(validUrl)};` +
        `end`;

    window.location.href = intentUrl;
}

firefoxButton.addEventListener("click", () => {
    const url = validateInstagramUrl(urlInput.value);

    if (!url) {
        alert("有効なInstagram投稿URLがありません。");
        return;
    }

    openInFirefox(url);
});










// --------------------------------------------------
// HTMLから取得できる情報を確認
// HTML本文そのものは表示しない
// --------------------------------------------------

function inspectResponse(text, contentType, finalUrl) {
    const lowerText = text.toLowerCase();

    const isHtml =
        contentType.toLowerCase().includes("text/html");

    const loginIndicators = [
        "loginform",
        "log in to instagram",
        "ログイン",
        "accounts/login",
        "login_required"
    ];

    const loginMatches = loginIndicators.filter(
        indicator => lowerText.includes(indicator)
    );

    const mediaIndicators = [
        "og:video",
        "og:image",
        "video_url",
        "display_url",
        "video_versions",
        "image_versions2"
    ];

    const mediaMatches = mediaIndicators.filter(
        indicator => lowerText.includes(indicator)
    );

    let finalHost = "-";
    let finalPath = "-";

    try {
        const parsed = new URL(finalUrl);
        finalHost = parsed.hostname;
        finalPath = parsed.pathname;
    } catch {
        // URLを解析できない場合は初期値のまま
    }

    return {
        isHtml,
        loginMatches,
        mediaMatches,
        finalHost,
        finalPath,
        bodyLength: text.length
    };
}


// --------------------------------------------------
// 1回のアクセス検証
// --------------------------------------------------

async function runFetchTest(url, credentialsMode) {
    const startedAt = Date.now();

    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
        controller.abort();
    }, 20000);

    try {
        const response = await fetch(url, {
            method: "GET",

            mode: "cors",

            credentials: credentialsMode,

            redirect: "follow",

            cache: "no-store",

            referrerPolicy: "no-referrer",

            signal: controller.signal,

            headers: {
                "Accept": "text/html,application/xhtml+xml"
            }
        });

        const responseText = await response.text();

        const elapsed = Date.now() - startedAt;

        const contentType =
            response.headers.get("content-type") || "不明";

        const inspected = inspectResponse(
            responseText,
            contentType,
            response.url
        );

        return {
            success: true,

            status: response.status,
            statusText: response.statusText,

            redirected: response.redirected,

            finalUrl: response.url,

            contentType,

            elapsed,

            inspected
        };

    } catch (error) {

        const elapsed = Date.now() - startedAt;

        let errorType = "通信エラー";

        if (error.name === "AbortError") {
            errorType = "タイムアウト";
        } else if (error instanceof TypeError) {
            errorType = "CORSまたはネットワークエラー";
        }

        return {
            success: false,
            errorType,
            errorName: error.name,
            elapsed
        };

    } finally {
        clearTimeout(timeoutId);
    }
}


// --------------------------------------------------
// 結果表示用HTML生成
// --------------------------------------------------

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}


function renderTestResult(element, result) {
    if (!result.success) {
        element.innerHTML = `
            <div class="status-error">
                <strong>${escapeHtml(result.errorType)}</strong>
            </div>

            <div>エラー名：${escapeHtml(result.errorName)}</div>
            <div>所要時間：${result.elapsed} ms</div>

            <p class="small-note">
                ブラウザーのCORS制限により、
                詳細な原因を取得できない場合があります。
            </p>
        `;

        return;
    }

    const inspected = result.inspected;

    const loginText = inspected.loginMatches.length
        ? inspected.loginMatches.join(", ")
        : "検出なし";

    const mediaText = inspected.mediaMatches.length
        ? inspected.mediaMatches.join(", ")
        : "検出なし";

    element.innerHTML = `
        <div class="status-success">
            <strong>レスポンス取得成功</strong>
        </div>

        <div>HTTP：${result.status} ${escapeHtml(result.statusText)}</div>

        <div>リダイレクト：${result.redirected ? "あり" : "なし"}</div>

        <div>最終ホスト：${escapeHtml(inspected.finalHost)}</div>

        <div>最終パス：${escapeHtml(inspected.finalPath)}</div>

        <div>Content-Type：${escapeHtml(result.contentType)}</div>

        <div>HTML：${inspected.isHtml ? "はい" : "いいえ"}</div>

        <div>本文サイズ：${inspected.bodyLength} 文字</div>

        <div>ログイン関連の文字列：${escapeHtml(loginText)}</div>

        <div>メディア関連の文字列：${escapeHtml(mediaText)}</div>

        <div>所要時間：${result.elapsed} ms</div>
    `;
}


// --------------------------------------------------
// サマリー表示
// --------------------------------------------------

function renderSummary(a, b) {
    const lines = [];

    if (a.success && b.success) {
        lines.push(
            "Cookieなし・Cookie送信許可の両方でレスポンスを取得できました。"
        );

        if (
            a.inspected.finalPath !== b.inspected.finalPath ||
            a.status !== b.status
        ) {
            lines.push(
                "両テストでステータスまたは最終URLに違いがあります。"
            );
        } else {
            lines.push(
                "両テストでステータスと最終URLは同じです。"
            );
        }

    } else if (!a.success && b.success) {
        lines.push(
            "Cookie送信許可の場合だけレスポンスを取得できました。"
        );

        lines.push(
            "ログイン状態またはCookieの影響がある可能性があります。"
        );

    } else if (a.success && !b.success) {
        lines.push(
            "Cookieなしの場合だけレスポンスを取得できました。"
        );

        lines.push(
            "Cookie送信時のCORS設定や通信条件に問題がある可能性があります。"
        );

    } else {
        lines.push(
            "どちらのテストでもレスポンスを取得できませんでした。"
        );

        lines.push(
            "CORS、ネットワーク制限、Instagram側のアクセス制限などが考えられます。"
        );
    }

    lines.push(
        "注意：Cookieが実際に送信されたかどうかは、このテストだけでは確認できません。"
    );

    lines.push(
        "また、レスポンス取得成功はメディア取得可能を意味しません。"
    );

    summary.innerHTML = lines
        .map(line => `<p>${escapeHtml(line)}</p>`)
        .join("");

    summaryPanel.classList.remove("hidden");
}


// --------------------------------------------------
// 検証実行
// --------------------------------------------------

async function runTests(url) {
    checkButton.disabled = true;

    testPanel.classList.remove("hidden");
    summaryPanel.classList.add("hidden");

    resultA.textContent = "実行中...";
    resultB.textContent = "待機中...";

    const a = await runFetchTest(url, "omit");

    renderTestResult(resultA, a);

    resultB.textContent = "実行中...";

    const b = await runFetchTest(url, "include");

    renderTestResult(resultB, b);

    renderSummary(a, b);

    checkButton.disabled = false;
}


// --------------------------------------------------
// 検証開始ボタン
// --------------------------------------------------

checkButton.addEventListener("click", async () => {
    const url = validateInstagramUrl(
        extractInstagramUrl(urlInput.value)
    );

    if (!url) {
        alert(
            "有効なInstagram投稿URLを入力してください。\n\n" +
            "対応形式：/p/ /reel/ /reels/ /tv/"
        );

        return;
    }

    currentTestUrl = url;

    urlInput.value = url;

    displayPostInfo(url);

    await runTests(url);
});


// --------------------------------------------------
// クリア
// --------------------------------------------------

clearButton.addEventListener("click", () => {
    if (checkButton.disabled) {
        return;
    }

    urlInput.value = "";

    resultPanel.classList.add("hidden");



    firefoxAction.classList.add("hidden");



    testPanel.classList.add("hidden");
    summaryPanel.classList.add("hidden");

    currentTestUrl = null;
});


// --------------------------------------------------
// Share TargetからのURL受け取り
// --------------------------------------------------

function processSharedData() {
    const params = new URLSearchParams(window.location.search);

    const sharedTitle = params.get("title") || "";
    const sharedText = params.get("text") || "";
    const sharedUrl = params.get("url") || "";

    const combinedText = [
        sharedUrl,
        sharedText,
        sharedTitle
    ].join("\n");

    const instagramUrl = extractInstagramUrl(combinedText);

    if (instagramUrl) {
        urlInput.value = instagramUrl;
        displayPostInfo(instagramUrl);
    }

    if (
        params.has("title") ||
        params.has("text") ||
        params.has("url")
    ) {
        window.history.replaceState(
            {},
            document.title,
            window.location.pathname
        );
    }
}


// --------------------------------------------------
// Service Worker登録
// --------------------------------------------------

async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
        swStatus.textContent = "Service Worker unavailable";
        return;
    }

    try {
        await navigator.serviceWorker.register("./sw.js");

        swStatus.textContent = "Offline support ready";

    } catch (error) {
        console.error(
            "Service Worker registration failed:",
            error
        );

        swStatus.textContent = "Service Worker error";
    }
}


// --------------------------------------------------
// 初期化
// --------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
    processSharedData();
    registerServiceWorker();
});