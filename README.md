# Instagram Media Downloader

A lightweight, client-side userscript for downloading photos and videos from Instagram posts.

The script is designed to work with Instagram's **Share** feature. Share a post from the Instagram app to a browser with Tampermonkey installed, and the script will extract the available media and let you preview, open, or download it.

No external downloader website or server is required.

## Features

- Download photos and videos from Instagram posts.
- Supports single-media posts and carousel posts.
- Preview images and videos before downloading.
- Open individual media files in a new browser tab.
- Automatically generates filenames using the Instagram shortcode and post caption.
- Adds numbered suffixes to filenames for carousel items.
- Retrieves media directly from Instagram's CDN.

## Requirements

- A web browser that supports Tampermonkey userscripts.
- [Tampermonkey](https://www.tampermonkey.net/) browser extension.
- Access to the Instagram post you want to download.

**Note:** This script is intended for use in a browser, not directly inside the Instagram app. The recommended workflow is to share a post from the Instagram app to your browser.

## Installation

### 1. Install Tampermonkey

Install Tampermonkey for your browser:

- [Tampermonkey Official Website](https://www.tampermonkey.net/)

Follow the installation instructions for your browser.

### 2. Install Instagram Media Downloader

1. Open the userscript file from the link below:

   [Instagram_Media_Downloader.user.js](https://raw.githubusercontent.com/makoto-kanda/instagram-media-saver/main/Instagram_Media_Downloader.user.js)

2. Tampermonkey should display the script installation page.

3. Review the script and click **Install**.

The script is now installed and should run automatically when you open an Instagram post in your browser.

## How to Use

### On Android

1. Open the Instagram app.
2. Find the post containing the photos or videos you want to download.
3. Tap the **Share** button.
4. Select your browser (for example, Firefox).
5. The browser opens the shared Instagram post URL.
6. Wait for Instagram Media Downloader to detect the post and display the available media.

### On Desktop

1. Open Instagram in your browser.
2. Navigate to the post you want to download.
3. Wait for the script to detect the available media.

### Preview and Download

For each available media item, the script provides the following actions:

- **Preview** — Preview the media. On desktop, hovering over a media item displays its preview.
- **Open** — Open the original media URL in a new browser tab.
- **Download** — Retrieve the media and request a download through the browser.

For carousel posts, each media item is listed separately. Downloaded files are numbered according to their original position in the post.

## Filename Format

Downloaded files use the following format:

**Single-media post**

`instagram_{shortcode}_{caption}.{extension}`

**Carousel post**

`instagram_{shortcode}_{caption}_{number}.{extension}`

Examples:

- `instagram_ABC123_Sample_caption.jpg`
- `instagram_ABC123_Sample_caption_1.jpg`
- `instagram_ABC123_Sample_caption_2.mp4`

The caption is sanitized to remove characters that are unsuitable for filenames. Long filenames are shortened.

## Limitations

- The script depends on Instagram's page structure and media data. Changes to Instagram may cause it to stop working until updated.
- Media must be accessible to your Instagram account. Private posts or content you cannot access may not be available.
- Only media successfully extracted from the post can be downloaded.
- Download behavior may vary depending on the browser and operating system.
- The script cannot reliably detect when the browser has finished saving a file. A download status message indicates that a download has been requested, not that it has completed.

## Privacy

- No external downloader server is used.
- Media is retrieved directly from Instagram's CDN.
- The script does not upload your Instagram URLs or downloaded media to a third-party service.
- No download history is maintained by the script.

## Disclaimer

This project is an independent userscript and is not affiliated with, endorsed by, or supported by Instagram or Meta.

Use it responsibly and respect the rights and privacy of content creators. You are responsible for complying with Instagram's terms and applicable laws.

## License

This project is licensed under the **GNU General Public License v3.0 or later (GPL-3.0-or-later)**.

You are free to use, modify, and redistribute this software under the terms of the license.

If you distribute modified versions of this software, you must make the corresponding source code available under the same license terms. This ensures that future users can benefit from further improvements.

See the [LICENSE](LICENSE) file for the full license text.

