(function () {
  "use strict";

  // このscriptタグ自身のsrcから、埋め込み元(自社サイト)のオリジンを特定する。
  // 例: <script src="https://cs-chatbot-green.vercel.app/widget.js"></script>
  var currentScript = document.currentScript;
  if (!currentScript) return;
  var origin = new URL(currentScript.src).origin;
  var chatUrl = origin + "/chat";

  var BUTTON_SIZE = 60;
  var PANEL_WIDTH = 380;
  var PANEL_HEIGHT = 600;
  var MARGIN = 20;

  var isOpen = false;

  var style = document.createElement("style");
  style.textContent =
    "#cs-chatbot-widget-button{position:fixed;bottom:" + MARGIN + "px;right:" + MARGIN + "px;" +
    "width:" + BUTTON_SIZE + "px;height:" + BUTTON_SIZE + "px;border-radius:9999px;" +
    "background:#059669;color:#fff;border:none;cursor:pointer;z-index:2147483000;" +
    "box-shadow:0 4px 14px rgba(0,0,0,.25);font-size:28px;display:flex;" +
    "align-items:center;justify-content:center;padding:0;line-height:1;}" +
    "#cs-chatbot-widget-frame{position:fixed;bottom:" + (MARGIN + BUTTON_SIZE + 12) + "px;right:" + MARGIN + "px;" +
    "width:" + PANEL_WIDTH + "px;height:" + PANEL_HEIGHT + "px;max-height:calc(100vh - " + (MARGIN * 2 + BUTTON_SIZE + 12) + "px);" +
    "border:none;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.3);z-index:2147483000;" +
    "display:none;background:#fff;}" +
    "#cs-chatbot-widget-frame.cs-chatbot-open{display:block;}" +
    "@media (max-width:480px){" +
    "#cs-chatbot-widget-frame{width:100vw;height:100vh;max-height:100vh;bottom:0;right:0;border-radius:0;}" +
    "}";
  document.head.appendChild(style);

  var button = document.createElement("button");
  button.id = "cs-chatbot-widget-button";
  button.setAttribute("aria-label", "チャットサポートを開く");
  button.textContent = "💬"; // 💬

  var iframe = document.createElement("iframe");
  iframe.id = "cs-chatbot-widget-frame";
  iframe.title = "カスタマーサポートチャット";
  iframe.setAttribute("loading", "lazy");

  button.addEventListener("click", function () {
    isOpen = !isOpen;
    if (isOpen) {
      if (!iframe.src) {
        iframe.src = chatUrl;
      }
      iframe.classList.add("cs-chatbot-open");
      button.textContent = "✕"; // ×
      button.setAttribute("aria-label", "チャットサポートを閉じる");
    } else {
      iframe.classList.remove("cs-chatbot-open");
      button.textContent = "💬";
      button.setAttribute("aria-label", "チャットサポートを開く");
    }
  });

  document.body.appendChild(iframe);
  document.body.appendChild(button);
})();
