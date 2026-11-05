import "./style.scss";
import { loadAlbum } from "./album.js";
import { inspectFiles, planParts, writeParts } from "./download.js";
import {
  createIcons,
  ArrowUpRight,
  ArrowRight,
  Link2,
  Download,
  Images,
  ShieldCheck,
  FolderArchive,
  AlertCircle,
  Check,
  FolderOpen,
  ChevronDown,
  Image,
} from "lucide";
const icons = {
  ArrowUpRight,
  ArrowRight,
  Link2,
  Download,
  Images,
  ShieldCheck,
  FolderArchive,
  AlertCircle,
  Check,
  FolderOpen,
  ChevronDown,
  Image,
};
document.querySelector("#app").innerHTML = `
<header class="header"><div class="nav-inner"><a class="brand" href="/" aria-label="AlbumDrop home"><span class="brand-mark"><i data-lucide="images"></i></span><span>albumdrop</span></a><nav aria-label="Main navigation"><a href="/#how">How it works</a><a href="/#questions">Questions</a></nav><a class="nav-cta" href="/#download">Get started <i data-lucide="arrow-up-right"></i></a></div></header>
<main>
<section class="hero" id="download"><div class="hero-glow" aria-hidden="true"></div><div class="hero-intro"><div class="eyebrow"><span class="eyebrow-dot"></span> A LITTLE SPACE FOR YOUR MEMORIES</div><h1>All your photos.<br><span>All together.</span></h1><p>Bring a shared Google Photos album home.<br class="desktop-break"> Just paste a link and we’ll take it from there.</p></div>
<div class="download-card"><div class="card-heading"><span class="link-symbol"><i data-lucide="link-2"></i></span><div><h2>Start with a link</h2><p>Paste a public Google Photos album link below.</p></div></div><form id="album-form"><label for="album-url">Google Photos album link</label><div class="input-row"><div class="input-wrap"><i data-lucide="link-2"></i><input id="album-url" type="url" placeholder="https://photos.app.goo.gl/..." required autocomplete="off"></div><button class="button primary" id="load-btn" type="submit">Find album <i data-lucide="arrow-right"></i></button></div></form><div id="result" aria-live="polite"></div><div class="card-foot"><span><i data-lucide="shield-check"></i> Public albums only</span><span class="foot-separator"></span><span>Up to 2 GB total</span></div></div>
<div class="hero-caption"><span>YOUR ALBUM, READY TO KEEP</span><span class="caption-line"></span><span>SCROLL TO EXPLORE</span></div></section>
<section class="visual-section" aria-label="A collection of photographs"><div class="photo-grid"><div class="photo-tile tile-one"><img src="https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1000&q=85" alt="A mountain reflected in a lake"></div><div class="photo-tile tile-two"><img src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=700&q=85" alt="A road through the mountains"></div><div class="photo-tile tile-three"><img src="https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=700&q=85" alt="A wide landscape in warm light"></div><div class="photo-tile tile-four"><img src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=700&q=85" alt="Mountain peaks under the sky"></div><div class="archive-badge"><span class="badge-icon"><i data-lucide="folder-archive"></i></span><span><strong>One collection.</strong><small>All yours to keep.</small></span><i class="badge-check" data-lucide="check"></i></div></div><div class="visual-copy"><p class="section-kicker">A BETTER WAY TO SAVE</p><h2>The moments you love,<br><span>right where you want them.</span></h2><p>No endless saving, one photo at a time. Put a shared album into ZIP files, ready for your own library.</p></div></section>
<section class="how-section" id="how"><div class="section-top"><div><p class="section-kicker">SIMPLE FROM THE START</p><h2>From link to library.<br><span>In three little steps.</span></h2></div><p>A few clicks, then back to the good stuff.</p></div><div class="step-grid"><article class="step-card"><span class="step-number">01</span><span class="step-icon blue"><i data-lucide="link-2"></i></span><h3>Copy the link.</h3><p>In Google Photos, open a shared album and copy its public link.</p></article><article class="step-card"><span class="step-number">02</span><span class="step-icon violet"><i data-lucide="images"></i></span><h3>Find your album.</h3><p>Paste the link here and we’ll gather the photos and videos available.</p></article><article class="step-card"><span class="step-number">03</span><span class="step-icon mint"><i data-lucide="folder-open"></i></span><h3>Make it yours.</h3><p>Choose a folder and save your collection in ready-to-keep ZIP files.</p></article></div></section>
<section class="details-section" id="questions"><div class="details-intro"><p class="section-kicker">GOOD TO KNOW</p><h2>The details,<br><span>made simple.</span></h2><p>Everything you need before you get started.</p></div><div class="faq-list"><details><summary>Which albums can I download?<i data-lucide="chevron-down"></i></summary><p>AlbumDrop works with publicly shared Google Photos album links. Private albums need to be opened in Google Photos.</p></details><details><summary>How much can I download?<i data-lucide="chevron-down"></i></summary><p>Albums can contain up to 2 GB of files. ZIPs are kept under 1 GB each, so larger collections are split into multiple ZIPs. A single file must fit in one ZIP.</p></details><details><summary>Where do my files go?<i data-lucide="chevron-down"></i></summary><p>Choose a folder in desktop Chrome or Edge and the ZIP files are written there. Keep the tab open while they’re being prepared.</p></details><details><summary>What about videos?<i data-lucide="chevron-down"></i></summary><p>Videos may be provided in a different quality by Google. Some hosting providers may be unable to retrieve them; if a download fails, open the album in Google Photos.</p></details></div></section>
<section class="closing"><div><p class="section-kicker">READY WHEN YOU ARE</p><h2>Keep the good stuff<br><span>close.</span></h2><p>Your next favorite memory is just a link away.</p><a href="/#download" class="button closing-button">Get started <i data-lucide="arrow-up-right"></i></a></div><div class="closing-icon" aria-hidden="true"><i data-lucide="image"></i></div></section></main>
<footer><div class="footer-inner"><a class="brand" href="/" aria-label="AlbumDrop home"><span class="brand-mark"><i data-lucide="images"></i></span><span>albumdrop</span></a><p>A little more room for what matters.</p><small>Independent of Google Photos.</small></div></footer>`;
createIcons({ icons });

const form = document.querySelector("#album-form");
const result = document.querySelector("#result");
const loadBtn = document.querySelector("#load-btn");
function escapeHtml(s) {
  const el = document.createElement("div");
  el.textContent = s;
  return el.innerHTML;
}
if (location.pathname !== "/") {
  document.querySelector("main").innerHTML =
    `<section class="not-found"><p class="section-kicker">404 / PAGE NOT FOUND</p><h1>Out of the picture.</h1><p>That page isn’t here. Let’s get you back to your albums.</p><a class="button primary" href="/">Back to AlbumDrop</a></section>`;
} else
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    result.innerHTML = "";
    loadBtn.disabled = true;
    loadBtn.textContent = "Opening album…";
    try {
      const data = await loadAlbum(
        document.querySelector("#album-url").value.trim(),
        (message) => {
          loadBtn.textContent = message;
        },
      );
      result.innerHTML = `<div class="result-box"><div class="result-info"><div class="result-icon"><i data-lucide="images"></i></div><div><strong>${escapeHtml(data.title)}</strong><p>${data.items.length} items available</p></div></div><button class="button primary" id="zip-btn">Choose folder & save <i data-lucide="download"></i></button><button class="button cancel" id="cancel-btn" hidden>Cancel</button><p class="result-note">Chrome or Edge on desktop required. ZIPs are saved in a new subfolder inside your chosen folder. Keep this tab open. Videos may be transcoded by Google. Private albums require access through Google Photos.</p><div id="progress" role="status"></div></div>`;
      createIcons({ icons });
      document
        .querySelector("#zip-btn")
        .addEventListener("click", async (event) => {
          const btn = event.currentTarget;
          const progress = document.querySelector("#progress");
          const cancel = document.querySelector("#cancel-btn");
          if (!window.showDirectoryPicker) {
            progress.textContent =
              "Use desktop Chrome or Edge to stream large ZIPs to disk, or download this album in Google Photos.";
            return;
          }
          const controller = new AbortController();
          cancel.onclick = () => controller.abort();
          btn.disabled = true;
          loadBtn.disabled = true;
          try {
            const selectedDirectory = await window.showDirectoryPicker({
              mode: "readwrite",
            });
            const directory = await selectedDirectory.getDirectoryHandle(
              `albumdrop-${Date.now()}`,
              { create: true },
            );
            cancel.hidden = false;
            const report = (text) => {
              progress.textContent = text;
            };
            const files = await inspectFiles(
              data.items,
              controller.signal,
              report,
            );
            const parts = planParts(files);
            await writeParts(parts, directory, controller.signal, report);
            progress.textContent = `Saved ${files.length} files in ${parts.length} ZIP${parts.length === 1 ? "" : "s"}.`;
          } catch (error) {
            progress.textContent =
              error.name === "AbortError"
                ? "Download cancelled. Completed ZIPs remain in your folder."
                : error.message;
          } finally {
            btn.disabled = false;
            loadBtn.disabled = false;
            cancel.hidden = true;
          }
        });
    } catch (error) {
      result.innerHTML = `<p class="error"><i data-lucide="alert-circle"></i>${escapeHtml(error.name === "TimeoutError" ? "Google took too long to respond. Try again." : error.message)}</p>`;
    } finally {
      loadBtn.disabled = false;
      loadBtn.innerHTML = 'Find album <i data-lucide="arrow-right"></i>';
      createIcons({ icons });
    }
  });
