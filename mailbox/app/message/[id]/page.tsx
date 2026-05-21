import Link from "next/link"
import { ArrowLeft, AlertTriangle } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { getEmailById } from "@/lib/emails"
import {createSupabaseServerClient} from '@/lib/supabase/server'
import { notFound } from "next/navigation";
import { EmailMessage } from "@/app/page"
import {GmailMessage, GmailMessagePart, GmailMessagePartBody} from '@/email-cloudflare-worker/src/index'
import { sanitize } from "isomorphic-dompurify";

export async function GetAttachmentData(accessToken:string, messageId:string, attachmentId:string): Promise<GmailMessagePartBody|null> {
  const getMessageUrl = new URL(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
  );

  const response = await fetch(getMessageUrl.toString(), {
      method: "GET",
      headers: {
          Authorization: `Bearer ${accessToken}`,
      },
  });
  if (!response.ok) {
    Promise.reject(`Error fetching attachement,${await response.json()}`);
    return null
  }
  const attachment: GmailMessagePartBody = await response.json();
  attachment.attachmentId = attachmentId
  return attachment
}

async function addRelatedAttachementsToBody(relatedAttachements: {contentId: string, mimeType:string, attachmentId: string}[],messageId:string, accessToken:string, body:string) {
    var promises: Promise<GmailMessagePartBody| null>[] = []
    var newBody = body
    relatedAttachements.forEach((attachementInfo) => promises.push(GetAttachmentData(accessToken, messageId, attachementInfo.attachmentId)))
    const attachments = await Promise.all(promises).catch((error) => console.log(error))
    if (attachments) {
        for (var attachment of attachments) {
            var contentId = "";
            var mimeType = "";

            relatedAttachements.forEach((element) => {
                if (element.attachmentId == attachment?.attachmentId) {
                    contentId = element.contentId;
                    mimeType = element.mimeType;
                    //replace src='cid:ContentId' with dataURL string in html
                    const base64Data = Buffer.from(attachment?.data, "base64url").toString(
                        "base64",
                    );
                    const dataUrl = `data:${mimeType};base64,${base64Data}`;
                    body = body.replaceAll(`cid:${contentId}`, dataUrl);
                }
            });

            newBody = body;
        }
    }
    
    return newBody
}

function GetAttachments (topLevelPart: GmailMessagePart) {
  var attachments: { related: {contentId: string, attachmentId: string, mimeType:string,}[], unrelated:{attachmentId:string, fileName:string, mimeType:string, size:number}[]} = {
    related: [],
    unrelated: []

  } 

  if (topLevelPart.mimeType === "multipart/related") {
    if (topLevelPart.parts) {
      for(var messagePart of topLevelPart.parts) {
        if (messagePart.mimeType !== "multipart/alternative") {
          const contentIdHeader = messagePart.headers.find((header) => header.name === 'Content-ID');
          const contentId = contentIdHeader? contentIdHeader.value.replace(/[< >]/g, ""):''
          const attachmentId = messagePart.body.attachmentId
          const mimeType = messagePart.mimeType
          attachments.related.push({contentId,attachmentId,mimeType})
        }
      }
    }

  } else if (topLevelPart.mimeType === "multipart/mixed") {
    if (topLevelPart.parts) {
      for(var messagePart of topLevelPart.parts) {
        if (messagePart.mimeType !== "multipart/alternative") {
          const attachmentId = messagePart.body.attachmentId
          const fileName = messagePart.filename
          const size = messagePart.body.size
          const mimeType = messagePart.mimeType;
          attachments.unrelated.push({attachmentId, fileName, size,mimeType})
        }
      }
    }
  }
  return attachments
}
function GetMessageBody (messageParts: GmailMessagePart[]) {
  for (var messagePart of messageParts) {
    if (messagePart.mimeType === 'text/html') {
      const encodedHtmlData = messagePart.body.data
      const decodedHtmlData = Buffer.from(
          encodedHtmlData,
          "base64url",
      ).toString("utf-8");
      //clean the html     
      return sanitize(decodedHtmlData);

    } 
    if (messagePart.parts){
      // look for the message body in the inner message parts
      return GetMessageBody(messagePart.parts)
    } 
  } 
  
  
}

function formatAttachmentSize(size: number) {
    if (size < 1024) {
        return `${size} B`;
    }

    const units = ["KB", "MB", "GB"];
    let attachmentSize = size / 1024;
    let unitIndex = 0;

    while (attachmentSize >= 1024 && unitIndex < units.length - 1) {
        attachmentSize = attachmentSize / 1024;
        unitIndex = unitIndex + 1;
    }

    return `${attachmentSize.toFixed(attachmentSize >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

export async function getAccessToken() {
    const workerResponse = await fetch(
        "https://email-worker.scienceclublss.me/access-token",
        { method: "GET" },
    );
    const accessToken: { access_token: string } = await workerResponse.json();
    if (workerResponse.ok) {
        return accessToken;
    }
    console.log('error retreiving access token ', workerResponse)
    return accessToken;
}



export default async function MailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
  

    const supabase = await createSupabaseServerClient();
    let fromEmail = ''
    let gmailMsgId = ''
    
    const { data: metaData, error } = await supabase
        .from("email_messages")
        .select()
        .eq("id", id);

    if (metaData) {
        if (metaData.length == 0) {
            notFound();
        }
        var gmailMsgMetaData: EmailMessage = metaData[0];
        const rowId = gmailMsgMetaData.id;
        fromEmail = gmailMsgMetaData.from_email
        gmailMsgId = gmailMsgMetaData.gmail_message_id;
        const labelIds = gmailMsgMetaData.labelids;
        
        if (!gmailMsgMetaData.is_read && labelIds !== null) {
            if (labelIds.includes("UNREAD")) {
                const newLabelIds = gmailMsgMetaData.labelids.filter(
                    (labelId) => labelId !== "UNREAD",
                );
                gmailMsgMetaData.labelids = newLabelIds;
                gmailMsgMetaData.is_read = true;
                const { data, error } = await supabase
                    .from("email_messages")
                    .update(gmailMsgMetaData)
                    .eq("id", rowId);
                    console.log(error)
            }   
        }
    }
    function GetStorageUrl(
        fileName: string,
    ) {
        const { data } = supabase.storage
            .from("email-attachments")
            .getPublicUrl(
                `${messageId}/${fileName}`,
            );
        return data.publicUrl
    }

    // retriving google access token
    const accessToken = await getAccessToken()
    
    const getMessageUrl = new URL(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailMsgId}`,
    );
    getMessageUrl.searchParams.set("format", "full");

    const response = await fetch(getMessageUrl.toString(), {
        method: "GET",
        headers: {
            Authorization: `Bearer ${accessToken.access_token}`,
        },
    });
    const gmailMessage: GmailMessage = await response.json();
    if (gmailMessage.error || !response.ok) {
      console.log(gmailMessage.error)
      notFound()
    } 
    const messageId = gmailMessage.id
    const isSpam = gmailMessage.labelIds
        ? gmailMessage.labelIds.includes("SPAM")
        : false;
    const receivedAt = new Date(Number(gmailMessage.internalDate)).toString();
    const payload = gmailMessage.payload;
    const subject = payload.headers.find(
        (header) => header.name === "Subject",
    )?.value;
    const fromName = payload.headers
        .find((header) => header.name === "From")
        ?.value?.replace(/\s*<[^>]+>\s*$/, "");
    
    const initials = fromName? fromName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2): 'XO'
    var messageBody = GetMessageBody([payload])
    const attachments = GetAttachments(payload)
    if (attachments.related.length !== 0 && messageBody) {
      messageBody = await addRelatedAttachementsToBody(attachments.related,messageId,accessToken.access_token,messageBody)
    }

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-3xl mx-auto">
                <div className="mb-4">
                    <Button asChild variant="ghost" size="sm" className="gap-2">
                        <Link href="/">
                            <ArrowLeft className="h-4 w-4" />
                            Back to inbox
                        </Link>
                    </Button>
                </div>

                <Card>
                    <CardContent className="p-6">
                        {isSpam && (
                            <div className="mb-5 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                <AlertTriangle className="h-4 w-4" />
                                This message is in Spam. Be careful with its
                                contents.
                            </div>
                        )}

                        <h1 className="text-2xl font-semibold tracking-tight text-balance">
                            {subject}
                        </h1>

                        <div className="mt-4 flex items-start gap-3">
                            <Avatar className="h-10 w-10 shrink-0">
                                <AvatarFallback className="bg-primary/15 text-primary text-sm font-semibold">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-medium">
                                        {fromName ? fromName : "Null"}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        &lt;{fromEmail}&gt;
                                    </span>
                                    {isSpam && (
                                        <Badge
                                            variant="destructive"
                                            className="h-5 px-1.5 text-xs"
                                        >
                                            Spam
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    to me &middot; {receivedAt}
                                </p>
                            </div>
                        </div>

                        <Separator className="my-5" />

                        <article className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                            <div
                                dangerouslySetInnerHTML={{
                                    __html: messageBody ?? " ",
                                }}
                            ></div>
                        </article>
                    </CardContent>
                </Card>

                {attachments.unrelated.length > 0 && (
                    <div className="mt-4 grid gap-2">
                        <span className="text-xs text-muted-foreground">
                            ATTACHMENTS
                        </span>
                        {attachments.unrelated.map((attachment) => (
                            <Card key={attachment.attachmentId} size="sm">
                                <CardContent className="p-3">
                                    <Link
                                        href={GetStorageUrl(attachment.fileName)}
                                        className="flex items-center justify-between gap-3 text-sm transition-colors hover:text-primary"
                                    >
                                        <span className="min-w-0 truncate font-medium">
                                            {attachment.fileName ||
                                                "Attachment"}
                                        </span>
                                        <span className="shrink-0 text-xs text-muted-foreground">
                                            {formatAttachmentSize(
                                                attachment.size,
                                            )}
                                        </span>
                                    </Link>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                <p className="mt-3 text-center text-xs text-muted-foreground">
                    Read-only view &middot; replying and forwarding are disabled
                </p>
            </div>
        </div>
    );
}
