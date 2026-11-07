// ==UserScript==
// @name         Instagram Media Downloader
// @namespace    https://github.com/makoto-kanda
// @version      0.9.0
// @description  Download videos and images from the currently viewed Instagram post
// @match        https://www.instagram.com/*
// @grant        GM_download
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(() => {
    'use strict';

    const VERSION = '0.9.0';
    const MARKER = 'xdt_api__v1__media__shortcode__web_info';
    const MAX_SCAN = 20 * 1024 * 1024;

    let panel;
    let media = [];

    // ------------------------------------------------------------
    // Utilities
    // ------------------------------------------------------------

    function currentShortcode() {
        const match = location.pathname.match(
            /^\/(?:p|reel|reels|tv)\/([^/?#]+)/
        );
        return match ? match[1] : null;
    }

    function balancedValue(text, start) {
        let open = -1;
        let openingChar = '';

        for (let i = start; i < text.length; i++) {
            if (text[i] === '{' || text[i] === '[') {
                open = i;
                openingChar = text[i];
                break;
            }
        }

        if (open < 0) return null;

        const closingChar = openingChar === '{' ? '}' : ']';
        let depth = 0;
        let inString = false;
        let escaped = false;

        for (let i = open; i < text.length; i++) {
            const ch = text[i];

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
            } else if (ch === openingChar) {
                depth++;
            } else if (ch === closingChar) {
                depth--;
                if (depth === 0) {
                    return text.slice(open, i + 1);
                }
            }
        }

        return null;
    }

    function findPropertyValue(text, property, from = 0) {
        const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp('"' + escaped + '"\\s*:', 'g');
        regex.lastIndex = from;

        const match = regex.exec(text);
        if (!match) return null;

        return balancedValue(text, regex.lastIndex);
    }

    function parseJSON(value) {
        if (!value) return null;
        try {
            return JSON.parse(value);
        } catch {
            return null;
        }
    }

    function getPageSources() {
        const sources = [];

        document.querySelectorAll('script').forEach(script => {
            if (script.textContent && script.textContent.length) {
                sources.push(script.textContent);
            }
        });

        sources.push(document.documentElement.innerHTML);

        return sources;
    }

    // ------------------------------------------------------------
    // Find the payload belonging to the current shortcode
    // ------------------------------------------------------------

    function findPostData(shortcode) {
        const sources = getPageSources();

        for (const source of sources) {
            if (source.length > MAX_SCAN) continue;

            let position = 0;

            while (true) {
                const markerIndex = source.indexOf(MARKER, position);
                if (markerIndex < 0) break;

                position = markerIndex + MARKER.length;

                const itemsText = findPropertyValue(
                    source,
                    'items',
                    markerIndex
                );

                if (!itemsText) continue;

                const items = parseJSON(itemsText);
                if (!Array.isArray(items)) continue;

                const post = items.find(item =>
                    item &&
                    (
                        item.code === shortcode ||
                        item.shortcode === shortcode
                    )
                );

                if (post) return post;
            }
        }

        return null;
    }

    // ------------------------------------------------------------
    // Media URL helpers
    // ------------------------------------------------------------

    function isInstagramCDN(url) {
        try {
            const host = new URL(url).hostname;
            return (
                host.endsWith('.cdninstagram.com') ||
                host.endsWith('.fbcdn.net')
            );
        } catch {
            return false;
        }
    }

    function getExtension(url, type) {
        try {
            const pathname = new URL(url).pathname;
            const match = pathname.match(/\.([a-z0-9]+)$/i);
            if (match) return match[1].toLowerCase();
        } catch {}

        return type === 'video' ? 'mp4' : 'jpg';
    }

    function getBestImage(candidates) {
        if (!Array.isArray(candidates)) return null;

        const valid = candidates
            .filter(item =>
                item &&
                typeof item.url === 'string' &&
                isInstagramCDN(item.url)
            )
            .sort((a, b) => {
                const sizeA = (a.width || 0) * (a.height || 0);
                const sizeB = (b.width || 0) * (b.height || 0);
                return sizeB - sizeA;
            });

        return valid[0] || null;
    }

    function getBestVideo(versions) {
        if (!Array.isArray(versions)) return null;

        const valid = versions
            .filter(item =>
                item &&
                typeof item.url === 'string' &&
                isInstagramCDN(item.url)
            )
            .sort((a, b) => {
                const sizeA = (a.width || 0) * (a.height || 0);
                const sizeB = (b.width || 0) * (b.height || 0);
                return sizeB - sizeA;
            });

        return valid[0] || null;
    }

    function mediaId(item) {
        return String(
            item?.pk ??
            item?.id ??
            item?.fbid ??
            ''
        );
    }

    // ------------------------------------------------------------
    // Collect media in original carousel order
    // ------------------------------------------------------------

    function collectMedia(post) {
        const mediaItems = Array.isArray(post.carousel_media)
            ? post.carousel_media
            : [post];

        const result = [];

        mediaItems.forEach((item, index) => {
            if (!item) return;

            const isVideo = !!(
                item.video_versions &&
                item.video_versions.length
            );

            if (isVideo) {
                const bestVideo = getBestVideo(item.video_versions);
                if (!bestVideo) return;

                // A video item normally has its own image_versions2
                // containing the thumbnail candidates.
                const thumbnail = getBestImage(
                    item.image_versions2?.candidates
                );

                result.push({
                    type: 'video',
                    id: mediaId(item),
                    url: bestVideo.url,
                    thumbnail: thumbnail?.url || item.display_uri || null,
                    width: bestVideo.width || 0,
                    height: bestVideo.height || 0,
                    index: index + 1,
                    ext: getExtension(bestVideo.url, 'video')
                });

                return;
            }

            const bestImage = getBestImage(
                item.image_versions2?.candidates
            );

            if (!bestImage) return;

            result.push({
                type: 'image',
                id: mediaId(item),
                url: bestImage.url,
                thumbnail: bestImage.url,
                width: bestImage.width || 0,
                height: bestImage.height || 0,
                index: index + 1,
                ext: getExtension(bestImage.url, 'image')
            });
        });

        return result.sort((a, b) => a.index - b.index);
    }

    // ------------------------------------------------------------
    // UI styles
    // ------------------------------------------------------------

    function addStyles() {
        if (document.getElementById('imd-style')) return;

        const style = document.createElement('style');
        style.id = 'imd-style';

        style.textContent = `
            #ig-media-downloader {
                position: fixed;
                z-index: 999999;
                top: 20px;
                right: 20px;
                width: 450px;
                max-height: 85vh;
                overflow: auto;
                background: #181818;
                color: #eee;
                border: 1px solid #555;
                border-radius: 9px;
                padding: 12px;
                font: 13px/1.4 Arial, sans-serif;
                box-shadow: 0 4px 20px #0009;
            }

            #ig-media-downloader button {
                cursor: pointer;
                background: #333;
                color: white;
                border: 1px solid #666;
                border-radius: 4px;
                padding: 4px 8px;
                margin-left: 4px;
            }

            #ig-media-downloader button:hover {
                background: #555;
            }

            #ig-media-downloader .imd-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 8px;
                margin-bottom: 10px;
            }

            #ig-media-downloader .imd-row {
                position: relative;
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 4px;
                border-bottom: 1px solid #333;
                border-radius: 4px;
            }

            #ig-media-downloader .imd-row:hover {
                background: #292929;
            }

            #ig-media-downloader .imd-info {
                flex: 1;
                min-width: 0;
            }

            #ig-media-downloader .imd-title {
                font-weight: bold;
                margin-bottom: 3px;
            }

            #ig-media-downloader .imd-meta {
                color: #aaa;
                font-size: 11px;
                overflow-wrap: anywhere;
            }

            #ig-media-downloader .imd-actions {
                white-space: nowrap;
            }

            #ig-media-downloader .imd-preview {
                display: none;
                position: fixed;
                z-index: 1000001;
                width: 220px;
                max-height: 300px;
                object-fit: contain;
                background: #111;
                border: 1px solid #777;
                border-radius: 6px;
                box-shadow: 0 5px 25px #000c;
                pointer-events: none;
            }

            #ig-media-downloader .imd-row.imd-previewing
            .imd-preview {
                display: block;
            }

            #ig-media-downloader #imd-status {
                color: #ccc;
                padding: 5px 0;
            }

            #ig-media-downloader #imd-empty {
                color: #aaa;
                padding: 12px 4px;
            }
        `;

        document.head.appendChild(style);
    }

    // ------------------------------------------------------------
    // Panel
    // ------------------------------------------------------------

    function createPanel() {
        if (panel) panel.remove();

        panel = document.createElement('div');
        panel.id = 'ig-media-downloader';

        panel.innerHTML = `
            <div class="imd-header">
                <strong>Instagram Media Downloader v${VERSION}</strong>
                <div>
                    <button id="imd-rescan">Rescan</button>
                    <button id="imd-close">Close</button>
                </div>
            </div>
            <div id="imd-status">Scanning...</div>
            <div id="imd-content"></div>
        `;

        document.body.appendChild(panel);

        panel.querySelector('#imd-close').onclick = () => panel.remove();
        panel.querySelector('#imd-rescan').onclick = scan;
    }

    // ------------------------------------------------------------
    // Preview positioning
    // ------------------------------------------------------------

    function showPreview(row, preview) {
        if (!preview.src) return;

        const rect = row.getBoundingClientRect();
        const previewWidth = 220;
        const previewHeight = 300;

        let left = rect.left - previewWidth - 12;

        // If there is insufficient room on the left, show it on the right.
        if (left < 8) {
            left = rect.right + 12;
        }

        // Keep the preview inside the viewport.
        if (left + previewWidth > window.innerWidth - 8) {
            left = Math.max(8, window.innerWidth - previewWidth - 8);
        }

        let top = rect.top;
        if (top + previewHeight > window.innerHeight - 8) {
            top = window.innerHeight - previewHeight - 8;
        }

        top = Math.max(8, top);

        preview.style.left = `${left}px`;
        preview.style.top = `${top}px`;
    }

    // ------------------------------------------------------------
    // Open / Download
    // ------------------------------------------------------------

    function openURL(url) {
        window.open(url, '_blank', 'noopener');
    }

    function downloadURL(item, shortcode) {
        const filename =
            `instagram_${shortcode}_${item.type}_${item.index}.${item.ext}`;

        GM_download({
            url: item.url,
            name: filename,
            saveAs: false,
            onerror: error => {
                console.error(
                    '[Instagram Downloader] Download error:',
                    error
                );
            }
        });
    }

    // ------------------------------------------------------------
    // Render media list
    // ------------------------------------------------------------

    function renderMedia(shortcode) {
        const content = panel.querySelector('#imd-content');
        content.innerHTML = '';

        if (!media.length) {
            const empty = document.createElement('div');
            empty.id = 'imd-empty';
            empty.textContent = 'No media found in this post.';
            content.appendChild(empty);
            return;
        }

        const heading = document.createElement('div');
        heading.style.cssText =
            'font-weight:bold; margin:12px 0 6px; border-bottom:1px solid #555; padding-bottom:6px;';
        heading.textContent = `MEDIA (${media.length})`;
        content.appendChild(heading);

        media.forEach(item => {
            const row = document.createElement('div');
            row.className = 'imd-row';

            const info = document.createElement('div');
            info.className = 'imd-info';

            const title = document.createElement('div');
            title.className = 'imd-title';

            const emoji = item.type === 'video' ? '🎬' : '🖼️';
            const label = item.type === 'video' ? 'VIDEO' : 'IMAGE';

            title.textContent =
                `${emoji} ${label} ${item.index} | ID: ${item.id || 'N/A'}`;

            const meta = document.createElement('div');
            meta.className = 'imd-meta';
            meta.textContent =
                `${item.width} × ${item.height} | URL length: ${item.url.length}`;

            info.append(title, meta);

            const actions = document.createElement('div');
            actions.className = 'imd-actions';

            const open = document.createElement('button');
            open.textContent = 'Open';
            open.onclick = () => openURL(item.url);

            const download = document.createElement('button');
            download.textContent = 'Download';
            download.onclick = () => downloadURL(item, shortcode);

            actions.append(open, download);

            row.append(info, actions);

            if (item.thumbnail) {
                const preview = document.createElement('img');
                preview.className = 'imd-preview';
                preview.alt = `${label} ${item.index} preview`;
                preview.loading = 'lazy';
                preview.src = item.thumbnail;

                row.appendChild(preview);

                row.addEventListener('mouseenter', () => {
                    row.classList.add('imd-previewing');
                    showPreview(row, preview);
                });

                row.addEventListener('mousemove', () => {
                    if (row.classList.contains('imd-previewing')) {
                        showPreview(row, preview);
                    }
                });

                row.addEventListener('mouseleave', () => {
                    row.classList.remove('imd-previewing');
                });
            }

            content.appendChild(row);
        });
    }

    // ------------------------------------------------------------
    // Main scan
    // ------------------------------------------------------------

    function scan() {
        if (!panel || !panel.isConnected) {
            createPanel();
        }

        const status = panel.querySelector('#imd-status');
        const content = panel.querySelector('#imd-content');

        status.textContent = 'Scanning current post...';
        content.innerHTML = '';
        media = [];

        const shortcode = currentShortcode();

        if (!shortcode) {
            status.textContent =
                'No post shortcode found. Open an Instagram post, Reel, or video.';
            return;
        }

        const post = findPostData(shortcode);

        if (!post) {
            status.textContent =
                `Could not find embedded data for shortcode: ${shortcode}`;
            return;
        }

        media = collectMedia(post);

        const videoCount = media.filter(
            item => item.type === 'video'
        ).length;

        const imageCount = media.filter(
            item => item.type === 'image'
        ).length;

        status.textContent =
            `${videoCount} video(s), ${imageCount} image(s) found`;

        renderMedia(shortcode);

        console.log('[Instagram Downloader] Current shortcode:', shortcode);
        console.log('[Instagram Downloader] Post data:', post);
        console.log('[Instagram Downloader] Media in post order:', media);
    }

    // ------------------------------------------------------------
    // Initialize
    // ------------------------------------------------------------

    addStyles();
    createPanel();

    setTimeout(scan, 1500);

})();
