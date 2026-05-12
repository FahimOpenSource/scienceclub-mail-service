const messageId = crypto.randomUUID();
const date = new Date().toUTCString();

const raw = [
    `From: mbaziirafahim61@gmail.com`,
    `To: fahim@scienceclublss.me`,
    `Subject: Foo`,
    `Date: ${date}`,
    `Message-ID: ${messageId}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset="utf-8"`,
    "",
    'This is a message to my beloved!!!',
].join("\r\n");

const url = new URL("http://127.0.0.1:8787/cdn-cgi/handler/email");
url.searchParams.set("from", "mbaziirafahim61@gmail.com");
url.searchParams.set("to", "fahim@scienceclublss.me");

const response = await fetch(url, {
    method: "POST",
    headers: {
        "Content-Type": "text/plain",
        "X-Message-ID": messageId,
    },
    body: raw,
});

console.log("Response:", await response.text());