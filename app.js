"use strict";

const urlInput = document.getElementById("urlInput");
const checkButton = document.getElementById("checkButton");
const clearButton = document.getElementById("clearButton");

const resultPanel = document.getElementById("resultPanel");
const postType = document.getElementById("postType");
const instagramLink = document.getElementById("instagramLink");
const resultMessage = document.getElementById("resultMessage");

const swStatus = document.getElementById("swStatus");


// Instagram URLを抽出する
function extractInstagramUrl(text) {
    if (!text) {
        return null;
    }

    const regex = /https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\/[^\s"'<>]+/gi;

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


// 投稿タイプを判定する
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

        if (/^\/stories\//i.test(pathname)) {
            return "ストーリーズ";
        }

        return "その他のInstagramページ";

    } catch {
        return "不明";
    }
}


// URLを画面に表示する
function displayResult(url) {
    if (!url) {
        resultPanel.classList.add("hidden");
        alert("有効なInstagram URLが見つかりませんでした。");
        return;
    }

    const type = detectPostType(url);

    urlInput.value = url;

    postType.textContent = type;

    instagramLink.textContent = url;
    instagramLink.href = url;

    resultMessage.textContent =
        "URLを受け取りました。現在のバージョンではURLの確認のみ行います。";

    resultPanel.classList.remove("hidden");
}


// 手動入力されたURLを確認
checkButton.addEventListener("click", () => {
    const url = extractInstagramUrl(urlInput.value);

    displayResult(url);
});


// クリア
clearButton.addEventListener("click", () => {
    urlInput.value = "";
    resultPanel.classList.add("hidden");
});


// Share Target APIから渡されたデータを処理
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
        displayResult(instagramUrl);
    }

    // 共有パラメータをURLから取り除く
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


// Service Worker登録
async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
        swStatus.textContent = "Service Worker unavailable";
        return;
    }

    try {
        await navigator.serviceWorker.register("./sw.js");

        swStatus.textContent = "Offline support ready";

    } catch (error) {
        console.error("Service Worker registration failed:", error);
        swStatus.textContent = "Service Worker error";
    }
}


// 初期化
document.addEventListener("DOMContentLoaded", () => {
    processSharedData();
    registerServiceWorker();
});