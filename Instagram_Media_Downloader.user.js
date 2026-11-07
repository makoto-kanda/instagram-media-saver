// ==UserScript==
// @name         Instagram Media Downloader
// @namespace    https://makoto-kanda.github.io/
// @version      1.0.0
// @description  Download Instagram photos and videos
// @icon         https://raw.githubusercontent.com/makoto-kanda/instagram-media-saver/main/icons/icon32.png
// @icon64       https://raw.githubusercontent.com/makoto-kanda/instagram-media-saver/main/icons/icon64.png
// @homepageURL  https://makoto-kanda.github.io/instagram-media-saver/
// @updateURL    https://raw.githubusercontent.com/makoto-kanda/instagram-media-saver/main/Instagram_Media_Downloader.user.js
// @downloadURL  https://raw.githubusercontent.com/makoto-kanda/instagram-media-saver/main/Instagram_Media_Downloader.user.js
// @match        https://www.instagram.com/*
// @grant        GM_download
// @grant        GM_addStyle
// @grant        GM_info
// @grant        GM_xmlhttpRequest
// @connect      cdninstagram.com
// @connect      fbcdn.net
// @run-at       document-idle
// ==/UserScript==

// Copyright (C) 2026 Makoto Kanda
// SPDX-License-Identifier: GPL-3.0-or-later

(() => {
    'use strict';

    const VERSION = '1.0.0';
    const MARKER =
        'xdt_api__v1__media__shortcode__web_info';

    const DOWNLOAD_MODE =
        GM_info?.downloadMode || 'unknown';

    let panel = null;
    let mediaList = null;
    let statusBox = null;
    let infoBox = null;

    let previewModal = null;
    let previewContent = null;

    let currentShortcode = null;
    let currentMedia = [];
    let currentPostMediaCount = 0;

    // Status timer
    let statusTimer = null;

    // --------------------------------------------------
    // CSS
    // --------------------------------------------------

    GM_addStyle(`
        #imd-panel {
            position: fixed;
            top: 12px;
            right: 12px;
            width: min(450px, calc(100vw - 24px));
            max-height: 85vh;
            z-index: 2147483647;
            background: #171717;
            color: #eee;
            border: 1px solid #555;
            border-radius: 10px;
            box-shadow: 0 4px 20px #0009;
            font: 13px/1.45 sans-serif;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        #imd-header {
            padding: 10px 12px;
            background: #252525;
            border-bottom: 1px solid #444;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
        }

        #imd-header strong {
            font-size: 14px;
        }

        #imd-version {
            color: #999;
            font-size: 11px;
        }

        #imd-body {
            padding: 10px;
            overflow-y: auto;
        }

        #imd-info {
            color: #aaa;
            margin-bottom: 8px;
            overflow-wrap: anywhere;
            white-space: pre-wrap;
        }

        #imd-status {
            padding: 8px;
            margin-bottom: 8px;
            background: #242424;
            border: 1px solid #444;
            border-radius: 6px;
            overflow-wrap: anywhere;
            white-space: pre-wrap;
        }

        #imd-status.imd-error {
            color: #ff9b9b;
            border-color: #a44;
        }

        #imd-status.imd-success {
            color: #9fe3a5;
            border-color: #487c4d;
        }

        #imd-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .imd-row {
            position: relative;
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 8px;
            padding: 8px;
            background: #222;
            border: 1px solid #444;
            border-radius: 7px;
        }

        .imd-row:hover {
            border-color: #777;
        }

        .imd-thumb {
            width: 64px;
            height: 64px;
            object-fit: cover;
            background: #000;
            border-radius: 4px;
            flex-shrink: 0;
        }

        .imd-label {
            flex: 1;
            min-width: 60px;
            overflow-wrap: anywhere;
            color: #ddd;
        }

        .imd-actions {
            display: flex;
            gap: 5px;
            flex-wrap: wrap;
        }

        .imd-btn {
            border: 1px solid #666;
            background: #333;
            color: #eee;
            border-radius: 5px;
            padding: 6px 10px;
            font-size: 12px;
            cursor: pointer;
        }

        .imd-btn:hover {
            background: #4a4a4a;
        }

        .imd-btn:active {
            background: #555;
        }

        /* Desktop: Preview button is unnecessary */
        .imd-preview-btn {
            display: none;
        }

        /* Mobile: Preview button opens the modal */
        @media (hover: none), (pointer: coarse) {
            .imd-preview-btn {
                display: inline-block;
            }
        }

        .imd-preview-inline {
            display: none;
            width: 100%;
            flex-basis: 100%;
            background: #000;
            border-radius: 6px;
            overflow: hidden;
        }

        .imd-row.imd-previewing .imd-preview-inline {
            display: block;
        }

        .imd-preview-inline img,
        .imd-preview-inline video {
            display: block;
            width: 100%;
            max-height: 320px;
            object-fit: contain;
            background: #000;
        }

        #imd-footer {
            padding: 8px 10px;
            color: #888;
            border-top: 1px solid #444;
            font-size: 11px;
        }

        /* Preview modal */

        #imd-modal {
            position: fixed;
            inset: 0;
            z-index: 2147483647;
            background: #000d;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 12px;
        }

        #imd-modal.imd-modal-open {
            display: flex;
        }

        #imd-modal-box {
            position: relative;
            width: min(900px, 100%);
            max-height: 90vh;
            background: #171717;
            border: 1px solid #555;
            border-radius: 10px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }

        #imd-modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            background: #252525;
            color: #eee;
        }

        #imd-modal-close {
            font-size: 22px;
            line-height: 1;
            border: none;
            background: transparent;
            color: #fff;
            cursor: pointer;
            padding: 4px 8px;
        }

        #imd-modal-content {
            overflow: auto;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #000;
        }

        #imd-modal-content img,
        #imd-modal-content video {
            display: block;
            max-width: 100%;
            max-height: 80vh;
            object-fit: contain;
        }

        @media (max-width: 600px) {
            #imd-panel {
                top: 8px;
                right: 8px;
                width: calc(100vw - 16px);
                max-height: 80vh;
            }

            .imd-thumb {
                width: 52px;
                height: 52px;
            }

            .imd-actions {
                width: 100%;
            }

            .imd-btn {
                flex: 1;
                min-width: 60px;
            }
        }
    `);

    // --------------------------------------------------
    // General utilities
    // --------------------------------------------------

    function getShortcode() {
        const match = location.pathname.match(
            /\/(?:p|reel|reels|tv)\/([^/]+)/
        );

        return match ? match[1] : null;
    }

    function isValidMediaUrl(url) {
        try {
            const parsed = new URL(url);

            return (
                parsed.protocol === 'https:' &&
                (
                    parsed.hostname.endsWith(
                        '.cdninstagram.com'
                    ) ||
                    parsed.hostname.endsWith(
                        '.fbcdn.net'
                    )
                )
            );
        } catch {
            return false;
        }
    }

    function sanitizeFilename(text) {
        return String(text || '')
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/[. ]+$/g, '')
            .slice(0, 100)
            .trim();
    }

    function setStatus(message, type = '') {
        if (!statusBox) return;

        // Cancel any pending automatic status reset.
        if (statusTimer) {
            clearTimeout(statusTimer);
            statusTimer = null;
        }

        statusBox.textContent = message;
        statusBox.className = '';

        if (type === 'error') {
            statusBox.classList.add('imd-error');
        } else if (type === 'success') {
            statusBox.classList.add('imd-success');
        }
    }

    function getReadyStatus() {
        return (
            `${currentMedia.length} media item(s) found.\n` +
            `Download Mode: ${DOWNLOAD_MODE}`
        );
    }

    function setTemporaryStatus(
        message,
        type = '',
        duration = 3000,
        shortcode = currentShortcode
    ) {
        setStatus(message, type);

        statusTimer = setTimeout(() => {
            statusTimer = null;

            // Do not overwrite the status of another post.
            if (currentShortcode !== shortcode) {
                return;
            }

            // Do not overwrite a newer status message.
            if (
                !statusBox ||
                statusBox.textContent !== message
            ) {
                return;
            }

            setStatus(getReadyStatus());
        }, duration);
    }

    function formatError(error) {
        if (!error) return 'Unknown error';

        if (typeof error === 'string') {
            return error;
        }

        const parts = [];

        if (error.error) parts.push(error.error);
        if (error.message) parts.push(error.message);
        if (error.details) parts.push(error.details);

        return parts.join(': ') ||
            JSON.stringify(error);
    }

    // --------------------------------------------------
    // JSON extraction
    //
    // HTML -> MARKER -> items array -> matching post.
    // --------------------------------------------------

    function findPropertyPosition(
        source,
        property,
        startIndex
    ) {
        const escaped = property.replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&'
        );

        const regex = new RegExp(
            `["']${escaped}["']\\s*:`,
            'g'
        );

        regex.lastIndex = Math.max(0, startIndex || 0);

        const match = regex.exec(source);

        return match ? regex.lastIndex : -1;
    }

    function extractBalancedJson(
        source,
        startIndex,
        openChar,
        closeChar
    ) {
        let start = startIndex;

        while (
            start < source.length &&
            /\s/.test(source[start])
        ) {
            start++;
        }

        if (source[start] !== openChar) {
            return null;
        }

        let depth = 0;
        let inString = false;
        let escaped = false;

        for (let i = start; i < source.length; i++) {
            const ch = source[i];

            if (inString) {
                if (escaped) {
                    escaped = false;
                } else if (ch === '\\') {
                    escaped = true;
                } else if (ch === '"') {
                    inString = false;
                }

                continue;
            }

            if (ch === '"') {
                inString = true;
                continue;
            }

            if (ch === openChar) {
                depth++;
            } else if (ch === closeChar) {
                depth--;

                if (depth === 0) {
                    return source.slice(start, i + 1);
                }
            }
        }

        return null;
    }

    function extractItemsArray(html, markerIndex) {
        const itemsPosition = findPropertyPosition(
            html,
            'items',
            markerIndex + MARKER.length
        );

        if (itemsPosition < 0) {
            return null;
        }

        const arrayText = extractBalancedJson(
            html,
            itemsPosition,
            '[',
            ']'
        );

        if (!arrayText) {
            return null;
        }

        try {
            return JSON.parse(arrayText);
        } catch (error) {
            console.warn(
                '[IMD] items JSON parse failed:',
                error
            );

            return null;
        }
    }

    function extractPostFromPage(shortcode) {
        // Important: use the complete page HTML.
        // Do not restrict the search to script elements.
        const html = document.documentElement.innerHTML;

        let searchPosition = 0;

        while (true) {
            const markerIndex = html.indexOf(
                MARKER,
                searchPosition
            );

            if (markerIndex < 0) {
                break;
            }

            searchPosition =
                markerIndex + MARKER.length;

            const items = extractItemsArray(
                html,
                markerIndex
            );

            if (!Array.isArray(items)) {
                continue;
            }

            const post = items.find(item =>
                item &&
                (
                    item.code === shortcode ||
                    item.shortcode === shortcode
                )
            );

            if (post) {
                console.log(
                    '[IMD] Matching post found:',
                    shortcode
                );

                return post;
            }
        }

        return null;
    }

    // --------------------------------------------------
    // Media extraction
    // --------------------------------------------------

    function getBestVideoUrl(item) {
        const versions = item?.video_versions;

        if (!Array.isArray(versions) || !versions.length) {
            return null;
        }

        const sorted = [...versions].sort((a, b) => {
            const aSize =
                (Number(a.width) || 0) *
                (Number(a.height) || 0);

            const bSize =
                (Number(b.width) || 0) *
                (Number(b.height) || 0);

            return bSize - aSize;
        });

        return sorted.find(v =>
            v.url && isValidMediaUrl(v.url)
        )?.url || null;
    }

    function getBestImageUrl(item) {
        const candidates =
            item?.image_versions2?.candidates;

        if (!Array.isArray(candidates) ||
            !candidates.length) {
            return null;
        }

        const sorted = [...candidates].sort((a, b) => {
            const aSize =
                (Number(a.width) || 0) *
                (Number(a.height) || 0);

            const bSize =
                (Number(b.width) || 0) *
                (Number(b.height) || 0);

            return bSize - aSize;
        });

        return sorted.find(c =>
            c.url && isValidMediaUrl(c.url)
        )?.url || null;
    }

    function getCaption(post) {
        const caption = post?.caption;

        if (typeof caption === 'string') {
            return caption;
        }

        if (caption?.text) {
            return caption.text;
        }

        return '';
    }

    function collectMedia(post) {
        if (!post) return [];

        const carousel = Array.isArray(
            post.carousel_media
        )
            ? post.carousel_media
            : null;

        const sourceItems =
            carousel && carousel.length
                ? carousel
                : [post];

        // Preserve the original number of media items,
        // including items that could not be extracted.
        currentPostMediaCount = sourceItems.length;

        const caption = getCaption(post);

        return sourceItems.map((item, index) => {
            const videoUrl = getBestVideoUrl(item);
            const imageUrl = getBestImageUrl(item);

            const url = videoUrl || imageUrl;

            if (!url || !isValidMediaUrl(url)) {
                return null;
            }

            return {
                // Keep the original carousel position.
                // This remains correct even if an unsupported
                // item is skipped.
                index: index + 1,
                url,
                thumbnailUrl: imageUrl || null,
                type: videoUrl ? 'video' : 'image',
                shortcode:
                    post.code ||
                    post.shortcode ||
                    currentShortcode,
                caption
            };
        }).filter(Boolean);
    }

    // --------------------------------------------------
    // Filename
    // --------------------------------------------------

    function getFilename(item) {
        const extension =
            item.type === 'video' ? 'mp4' : 'jpg';

        const caption = sanitizeFilename(
            item.caption
        );

        const base =
            caption ||
            item.shortcode ||
            'media';

        // Add a sequence number only for carousel posts.
        // Use the original number of items in the post,
        // not the number of successfully extracted items.
        const suffix =
            currentPostMediaCount > 1
                ? `_${item.index}`
                : '';

        return (
            `instagram_${item.shortcode}_` +
            `${base}${suffix}.${extension}`
        );
    }

    // --------------------------------------------------
    // Preview
    // --------------------------------------------------

    function makePreviewElement(item) {
        let element;

        if (item.type === 'video') {
            element = document.createElement('video');
            element.src = item.url;
            element.controls = true;
            element.playsInline = true;
            element.preload = 'metadata';
        } else {
            element = document.createElement('img');
            element.src = item.url;
            element.alt = 'Instagram media preview';
        }

        return element;
    }

    function openPreview(item) {
        if (!previewModal || !previewContent) {
            return;
        }

        previewContent.replaceChildren(
            makePreviewElement(item)
        );

        previewModal.classList.add(
            'imd-modal-open'
        );
    }

    function closePreview() {
        if (!previewModal || !previewContent) {
            return;
        }

        const video =
            previewContent.querySelector('video');

        if (video) video.pause();

        previewModal.classList.remove(
            'imd-modal-open'
        );

        previewContent.replaceChildren();
    }

    // --------------------------------------------------
    // Open
    // --------------------------------------------------

    function openMedia(item) {
        const tab = window.open(
            item.url,
            '_blank',
            'noopener'
        );

        if (!tab) {
            setStatus(
                'Open failed: Firefox blocked the new tab.',
                'error'
            );
        } else {
            setStatus('Media opened in a new tab.');
        }
    }

    // --------------------------------------------------
    // Download
    // --------------------------------------------------

    function downloadMedia(item) {
        const filename = getFilename(item);
        const shortcodeAtStart = currentShortcode;

        // Snapshot the total number of media items at click time.
        // Do not use currentMedia.length in asynchronous callbacks.
        const totalItemsAtStart = currentMedia.length;

        const progress =
            `Preparing download: ` +
            `${item.index}/${totalItemsAtStart}`;

        setStatus(progress);

        console.log(
            '[IMD] Download clicked:',
            item
        );

        if (!isValidMediaUrl(item.url)) {
            setStatus(
                'Download failed: Invalid media URL.',
                'error'
            );
            return;
        }

        let finished = false;
        let fetchWatchdog = null;

        function fail(message, error = null) {
            if (finished) return;

            finished = true;

            if (fetchWatchdog) {
                clearTimeout(fetchWatchdog);
            }

            console.error(
                '[IMD] Download failed:',
                message,
                error
            );

            // Avoid showing an error from an old post
            // over the status of a newly opened post.
            if (currentShortcode === shortcodeAtStart) {
                setStatus(
                    `Download failed:\n${message}`,
                    'error'
                );
            }
        }

        fetchWatchdog = setTimeout(() => {
            fail('Media request timed out after 95 seconds.');
        }, 95000);

        try {
            GM_xmlhttpRequest({
                method: 'GET',
                url: item.url,
                responseType: 'blob',
                timeout: 90000,

                onload: response => {
                    if (finished) return;

                    clearTimeout(fetchWatchdog);

                    if (
                        response.status < 200 ||
                        response.status >= 300
                    ) {
                        fail(
                            `Media request failed. HTTP ${response.status}`
                        );
                        return;
                    }

                    const blob = response.response;

                    if (!(blob instanceof Blob)) {
                        fail(
                            'Media response is not a Blob.'
                        );
                        return;
                    }

                    if (!blob.size) {
                        fail('Received an empty media file.');
                        return;
                    }

                    console.log(
                        '[IMD] Media received:',
                        blob.size,
                        'bytes',
                        blob.type
                    );

                    // Do not overwrite the status for a
                    // different post if navigation occurred.
                    if (currentShortcode === shortcodeAtStart) {
                        setStatus(
                            `Starting download: ` +
                            `${item.index}/${totalItemsAtStart}`
                        );
                    }

                    saveBlobWithAnchor(
                        blob,
                        filename,
                        item.index,
                        totalItemsAtStart,
                        shortcodeAtStart
                    );
                },

                onerror: error => {
                    fail(
                        'Media request error: ' +
                        formatError(error),
                        error
                    );
                },

                ontimeout: () => {
                    fail('Media request timed out.');
                },

                onabort: () => {
                    fail('Media request was aborted.');
                }
            });
        } catch (error) {
            fail(
                'GM_xmlhttpRequest exception: ' +
                formatError(error),
                error
            );
        }
    }

    // --------------------------------------------------
    // Save Blob using Firefox's native anchor handling
    // --------------------------------------------------

    function saveBlobWithAnchor(
        blob,
        filename,
        itemIndex,
        totalItems,
        shortcodeAtStart
    ) {
        let objectUrl = null;
        let anchor = null;

        try {
            objectUrl = URL.createObjectURL(blob);

            anchor = document.createElement('a');
            anchor.href = objectUrl;
            anchor.download = filename;
            anchor.style.display = 'none';

            document.body.appendChild(anchor);

            console.log(
                '[IMD] Starting anchor download:',
                filename
            );

            anchor.click();

            // The anchor click requests the browser download.
            // Actual file completion cannot be detected here.
            if (currentShortcode === shortcodeAtStart) {
                setTemporaryStatus(
                    `Download started: ${itemIndex}/${totalItems}`,
                    'success',
                    3000,
                    shortcodeAtStart
                );
            }

            // Keep the Blob URL alive long enough for Firefox
            // to begin processing the download.
            setTimeout(() => {
                if (anchor && anchor.parentNode) {
                    anchor.parentNode.removeChild(anchor);
                }

                if (objectUrl) {
                    URL.revokeObjectURL(objectUrl);
                    objectUrl = null;
                }

                console.log(
                    '[IMD] Blob URL released:',
                    filename
                );
            }, 60000);

        } catch (error) {
            if (anchor && anchor.parentNode) {
                anchor.parentNode.removeChild(anchor);
            }

            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }

            console.error(
                '[IMD] Anchor download exception:',
                error
            );

            if (currentShortcode === shortcodeAtStart) {
                setStatus(
                    `Download failed:\n` +
                    `Could not start browser download: ` +
                    `${formatError(error)}`,
                    'error'
                );
            }
        }
    }

    // --------------------------------------------------
    // UI creation
    // --------------------------------------------------

    function createPanel() {
        if (panel) return;

        panel = document.createElement('div');
        panel.id = 'imd-panel';

        const header =
            document.createElement('div');

        header.id = 'imd-header';

        const title =
            document.createElement('div');

        title.innerHTML =
            `<strong>Instagram Media Saver</strong> ` +
            `<span id="imd-version">v${VERSION}</span>`;

        const closeButton =
            document.createElement('button');

        closeButton.className = 'imd-btn';
        closeButton.textContent = 'Close';

        closeButton.addEventListener('click', () => {
            panel.style.display = 'none';
        });

        header.append(title, closeButton);

        const body =
            document.createElement('div');

        body.id = 'imd-body';

        infoBox =
            document.createElement('div');

        infoBox.id = 'imd-info';

        statusBox =
            document.createElement('div');

        statusBox.id = 'imd-status';

        statusBox.textContent =
            `Download Mode: ${DOWNLOAD_MODE}`;

        mediaList =
            document.createElement('div');

        mediaList.id = 'imd-list';

        body.append(
            infoBox,
            statusBox,
            mediaList
        );

        const footer =
            document.createElement('div');

        footer.id = 'imd-footer';

        footer.textContent =
            'Desktop: hover media row | Mobile: Preview button';

        panel.append(
            header,
            body,
            footer
        );

        document.body.appendChild(panel);

        // Modal
        previewModal =
            document.createElement('div');

        previewModal.id = 'imd-modal';

        const modalBox =
            document.createElement('div');

        modalBox.id = 'imd-modal-box';

        const modalHeader =
            document.createElement('div');

        modalHeader.id = 'imd-modal-header';

        const modalTitle =
            document.createElement('span');

        modalTitle.textContent = 'Preview';

        const modalClose =
            document.createElement('button');

        modalClose.id = 'imd-modal-close';
        modalClose.type = 'button';
        modalClose.textContent = '×';
        modalClose.setAttribute(
            'aria-label',
            'Close preview'
        );

        modalClose.addEventListener(
            'click',
            closePreview
        );

        modalHeader.append(
            modalTitle,
            modalClose
        );

        previewContent =
            document.createElement('div');

        previewContent.id = 'imd-modal-content';

        modalBox.append(
            modalHeader,
            previewContent
        );

        previewModal.appendChild(modalBox);

        previewModal.addEventListener('click', event => {
            if (event.target === previewModal) {
                closePreview();
            }
        });

        document.body.appendChild(previewModal);

        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                closePreview();
            }
        });
    }

    // --------------------------------------------------
    // Render media
    // --------------------------------------------------

    function renderMedia(items) {
        createPanel();

        mediaList.replaceChildren();

        if (!items.length) {
            const empty =
                document.createElement('div');

            empty.textContent = 'No media found.';

            mediaList.appendChild(empty);

            return;
        }

        items.forEach(item => {
            const row =
                document.createElement('div');

            row.className = 'imd-row';

            const thumb =
                document.createElement('img');

            thumb.className = 'imd-thumb';

            // Use the image candidate as thumbnail.
            // Do not use an MP4 URL as an img source.
            thumb.src =
                item.thumbnailUrl ||
                (item.type === 'image' ? item.url : '');

            thumb.alt = '';
            thumb.loading = 'lazy';

            const label =
                document.createElement('div');

            label.className = 'imd-label';

            label.textContent =
                `${item.index}. ${item.type.toUpperCase()}`;

            const actions =
                document.createElement('div');

            actions.className = 'imd-actions';

            // Preview button: mobile only
            const previewButton =
                document.createElement('button');

            previewButton.className =
                'imd-btn imd-preview-btn';

            previewButton.textContent = 'Preview';

            previewButton.addEventListener(
                'click',
                event => {
                    event.stopPropagation();
                    openPreview(item);
                }
            );

            // Open
            const openButton =
                document.createElement('button');

            openButton.className = 'imd-btn';
            openButton.textContent = 'Open';

            openButton.addEventListener(
                'click',
                event => {
                    event.stopPropagation();
                    openMedia(item);
                }
            );

            // Download
            const downloadButton =
                document.createElement('button');

            downloadButton.className = 'imd-btn';
            downloadButton.textContent = 'Download';

            downloadButton.addEventListener(
                'click',
                event => {
                    event.stopPropagation();
                    downloadMedia(item);
                }
            );

            actions.append(
                previewButton,
                openButton,
                downloadButton
            );

            const inlinePreview =
                document.createElement('div');

            inlinePreview.className =
                'imd-preview-inline';

            row.append(
                thumb,
                label,
                actions,
                inlinePreview
            );

            // Desktop hover preview.
            // The row is the hover target, not the preview itself.
            row.addEventListener(
                'pointerenter',
                event => {
                    if (event.pointerType !== 'mouse') {
                        return;
                    }

                    row.classList.add(
                        'imd-previewing'
                    );

                    if (!inlinePreview.hasChildNodes()) {
                        inlinePreview.appendChild(
                            makePreviewElement(item)
                        );
                    }
                }
            );

            row.addEventListener(
                'pointerleave',
                event => {
                    if (event.pointerType !== 'mouse') {
                        return;
                    }

                    row.classList.remove(
                        'imd-previewing'
                    );

                    const video =
                        inlinePreview.querySelector('video');

                    if (video) video.pause();
                }
            );

            mediaList.appendChild(row);
        });
    }

    // --------------------------------------------------
    // Page update
    // --------------------------------------------------

    function updatePage() {
        const shortcode = getShortcode();

        if (!shortcode) {
            if (panel) {
                panel.style.display = 'none';
            }

            currentShortcode = null;
            currentMedia = [];
            currentPostMediaCount = 0;

            if (statusTimer) {
                clearTimeout(statusTimer);
                statusTimer = null;
            }

            return;
        }

        if (shortcode === currentShortcode) {
            if (panel) {
                panel.style.display = 'flex';
            }

            return;
        }

        if (statusTimer) {
            clearTimeout(statusTimer);
            statusTimer = null;
        }

        currentShortcode = shortcode;

        createPanel();

        panel.style.display = 'flex';

        infoBox.textContent =
            `Post: ${shortcode}\n` +
            `Download Mode: ${DOWNLOAD_MODE}`;

        setStatus(
            'Extracting Instagram media...'
        );

        mediaList.replaceChildren();

        // Restore proven extraction method.
        const post = extractPostFromPage(shortcode);

        if (!post) {
            currentMedia = [];
            currentPostMediaCount = 0;

            renderMedia([]);

            setStatus(
                'Media not found.\n' +
                'The expected items array was not found ' +
                'or the post shortcode did not match.',
                'error'
            );

            console.warn(
                '[IMD] Post not found:',
                shortcode
            );

            return;
        }

        currentMedia = collectMedia(post);

        renderMedia(currentMedia);

        if (!currentMedia.length) {
            setStatus(
                'Post found, but no supported media URLs were extracted.',
                'error'
            );

            console.warn(
                '[IMD] Post object:',
                post
            );

            return;
        }

        setStatus(getReadyStatus());

        console.log(
            '[IMD] Extracted media:',
            currentMedia
        );
    }

    // --------------------------------------------------
    // SPA navigation
    // --------------------------------------------------

    let lastUrl = location.href;

    function checkNavigation() {
        if (location.href !== lastUrl) {
            lastUrl = location.href;

            currentShortcode = null;

            setTimeout(updatePage, 700);
        }
    }

    const observer = new MutationObserver(() => {
        checkNavigation();
    });

    observer.observe(
        document.documentElement,
        {
            childList: true,
            subtree: true
        }
    );

    window.addEventListener(
        'popstate',
        () => {
            currentShortcode = null;

            if (statusTimer) {
                clearTimeout(statusTimer);
                statusTimer = null;
            }

            setTimeout(updatePage, 700);
        }
    );

    // --------------------------------------------------
    // Start
    // --------------------------------------------------

    setTimeout(updatePage, 1500);

    console.log(
        `[Instagram Media Saver] v${VERSION} loaded`,
        'Download Mode:',
        DOWNLOAD_MODE
    );
})();