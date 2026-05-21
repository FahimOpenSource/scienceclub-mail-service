
'use client'
import { sanitize } from "isomorphic-dompurify";

export default function EmailBody({ html }: { html: string }) {
    const sanitizedHtml = sanitize(html, {
        ADD_TAGS: ["iframe"],
        ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling","style", "target"],
    });    
    const srcDoc = `
    <!doctype html>
    <html>
      <head>
        <base target="_blank" />
        <style>

        @font-face {
          font-family: "EmailJetBrainsMono";
          src: url("/fonts/JetBrainsMono-VariableFont_wght.ttf") format("ttf");
          font-weight: 100 800;
          font-style: normal;
          font-display: swap;
        }
          html, body {
            margin: 0;
            padding: 0;
            overflow-wrap: anywhere;
          }

          body {
            font-family: "EmailJetBrainsMono", monospace;
            padding: 16px;
          }

          img {
            max-width: 100%;
            height: auto;
          }

          table {
            max-width: 100%;
          }

          * {
            box-sizing: border-box;
          }
        </style>
      </head>
      <body>
        ${sanitizedHtml}
      </body>
    </html>
  `;

    return (
        <iframe
            title="Email content"
            srcDoc={srcDoc}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            className="w-full "
            style={{
                minHeight: "600px",
                border: "0",
            }}
        />
    );

}
